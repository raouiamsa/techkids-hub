import os
import json
import json_repair
import requests
from dotenv import load_dotenv

from core.state import AgentState
from core.prompts_library import (
    get_enricher_qcm_prompt,
    get_enricher_code_prompt,
    get_writer_synthesis_prompt,
    get_writer_capstone_prompt
)
from agents.writer import _invoke_with_fallback, _clean_json, _ensure_dict, code_expert_model
from agents.validator import validate_code

load_dotenv()

def enricher_node(state: AgentState):
    """
    Node Finaliseur (Lazy Generation)
    Exécuté uniquement APRES l'approbation de la théorie par le Critique.
    Génère les QCM, exercices de code, la synthèse et le projet final.
    """
    print("[Enricher] Démarrage du processus de Lazy Generation (Exercices & Projets)...")
    
    lang = state.get("programming_language", "Python")
    age = state.get("age_group", 12)
    internal_secret = state.get("internal_secret", os.getenv("INTERNAL_AI_SECRET", "votre-secret-pfe-2026"))
    draft_id = state.get("draft_id")
    
    strategy = state.get("pdf_code_strategy", "code_from_pdf")
    include_code_exercises = state.get("include_code_exercises", True)
    if strategy == "qcm_only":
        include_code_exercises = False

    # Extraire le dernier contenu approuvé
    content_list = state.get("content") or []
    if not content_list:
        print("[Enricher] Erreur : Aucun contenu à enrichir.")
        return {}

    course_data = _ensure_dict(json_repair.loads(content_list[-1]))
    modules = course_data.get("modules", [])
    total_modules = len(modules)

    # 1. Génération des Exercices par Module
    for index, mod in enumerate(modules):
        mod_title = mod.get("title", f"Module {index + 1}")
        mod_content = mod.get("content", "")
        
        # Télémétrie
        if draft_id:
            try:
                requests.patch(
                    f"http://localhost:3000/api/ai/internal/drafts/{draft_id}/progress",
                    json={
                        "progressPercent": int(80 + (index / max(1, total_modules)) * 10), 
                        "agent_status": f"⚡ [Enrichisseur] Génération des exercices pour : {mod_title[:30]}..."
                    },
                    headers={"x-ai-secret": internal_secret}, timeout=2
                )
            except: pass

        print(f"    [Enricher] Génération exercices pour : {mod_title}")
        
        # 1A. QCM (Mistral / Groq)
        try:
            qcm_prompt = get_enricher_qcm_prompt(mod_content, age, lang)
            qcm_res = _invoke_with_fallback(qcm_prompt)
            mod["exercises_text"] = _ensure_dict(json_repair.loads(_clean_json(qcm_res)))
            # S'assurer que c'est une liste
            if not isinstance(mod["exercises_text"], list):
                if isinstance(mod["exercises_text"], dict):
                    mod["exercises_text"] = [mod["exercises_text"]]
                else:
                    mod["exercises_text"] = []
        except Exception as e:
            print(f"      [Erreur QCM] {e}")
            mod["exercises_text"] = []

        # 1B. Code (Qwen Coder)
        if include_code_exercises and code_expert_model:
            max_code_retries = 2
            code_success = False
            error_feedback = ""
            for attempt in range(max_code_retries):
                try:
                    code_prompt = get_enricher_code_prompt(mod_content, age, lang)
                    if error_feedback:
                        code_prompt += f"\n\n🚨 ALERTE ERREUR : Le code precedent etait invalide : {error_feedback}\nCorrige-le immediatement."
                        
                    code_res = code_expert_model.invoke(code_prompt)
                    mod["exercises_code"] = _ensure_dict(json_repair.loads(_clean_json(code_res)))
                    if not isinstance(mod["exercises_code"], list):
                        if isinstance(mod["exercises_code"], dict):
                            mod["exercises_code"] = [mod["exercises_code"]]
                        else:
                            mod["exercises_code"] = []
                            
                    # Validation du code generé
                    if mod["exercises_code"] and isinstance(mod["exercises_code"][0], dict) and mod["exercises_code"][0].get("solution"):
                        val_res = validate_code(mod["exercises_code"][0]["solution"], lang)
                        if val_res.get("valid") is False:
                            error_feedback = val_res.get("error", "Erreur de syntaxe inconnue")
                            print(f"      [Validator] Code invalide (Tentative {attempt+1}) : {error_feedback}")
                            continue # Retry
                            
                    code_success = True
                    break # Succes !
                except Exception as e:
                    print(f"      [Erreur Code] {e}")
                    error_feedback = str(e)
            
            if not code_success:
                print(f"      [Validator] Echec de validation pour {mod_title}. Exercice conserve pour revision humaine.")
        else:
            mod["exercises_code"] = []

    # 2. Génération Synthèse et Projet Final
    print("    [Enricher] Création de la Synthèse et du Projet Final...")
    if draft_id:
        try:
            requests.patch(
                f"http://localhost:3000/api/ai/internal/drafts/{draft_id}/progress",
                json={"progressPercent": 95, "agent_status": "🎓 [Enrichisseur] Création du projet final..."},
                headers={"x-ai-secret": internal_secret}, timeout=2
            )
        except: pass

    modules_sum = "\n".join([f"- {m.get('title', '?')}" for m in modules])
    try:
        synth_res = _invoke_with_fallback(get_writer_synthesis_prompt(modules_sum))
        synth_data = _ensure_dict(json_repair.loads(_clean_json(synth_res)))
        synth_data.update({"is_synthesis": True, "exercises_text": [], "exercises_code": [], "order": len(modules) + 1})
        course_data["modules"].append(synth_data)
        
        proj_res = _invoke_with_fallback(get_writer_capstone_prompt(modules_sum))
        course_data["final_project"] = _ensure_dict(json_repair.loads(_clean_json(proj_res)))
    except Exception as e:
        print(f"      [Erreur Projet Final] {e}")

    # Télémétrie Finale (100%)
    if draft_id:
        try:
            requests.patch(
                f"http://localhost:3000/api/ai/internal/drafts/{draft_id}/progress",
                json={
                    "progressPercent": 100,
                    "agent_status": "✅ [Enrichisseur] Cours complet généré avec succès !"
                },
                headers={"x-ai-secret": internal_secret}, timeout=2
            )
        except: pass

    # Mettre à jour le state final
    return {
        "content": [json.dumps(course_data, ensure_ascii=False)],
        "final_project": json.dumps(course_data.get("final_project", {}))
    }
