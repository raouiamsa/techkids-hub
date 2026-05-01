import os
import re
import json
import json_repair
import requests
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from langchain_nvidia_ai_endpoints import ChatNVIDIA
from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint, HuggingFaceEmbeddings
from langchain_chroma import Chroma
from dotenv import load_dotenv
from core.state import AgentState
from core.prompts_library import (
    get_writer_module_prompt
)

load_dotenv()

# ============================================================
# 1. Configuration des Modèles
# ============================================================

def _init_model(cls, **kwargs):
    try:
        key = kwargs.get("openai_api_key") or kwargs.get("api_key") or kwargs.get("nvidia_api_key")
        if key: return cls(**kwargs)
    except Exception as e:
        print(f"[Avertissement] Echec de l'initialisation pour {cls}: {e}")
    return None

# Plan A : NVIDIA Mistral Nemotron
_nvidia_model = _init_model(ChatNVIDIA,
    model="mistralai/mistral-nemotron",
    api_key=os.getenv("NVIDIA_API_KEY"),
    temperature=0.7,
    max_tokens=4096
)

# Plan B : Groq (Llama 3.3 70B Versatile)
_groq_fallback = _init_model(ChatGroq,
    model="llama-3.3-70b-versatile",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.7
)

def _invoke_with_fallback(prompt: str):
    """Essaye NVIDIA Nemotron 2 fois, sinon bascule sur Groq Llama 70B Versatile."""
    if _nvidia_model:
        for i in range(2):
            try:
                # Affichage discret pour ne pas polluer les logs de la boucle principale
                res = _nvidia_model.invoke(prompt)
                if res.content and len(res.content.strip()) > 100: return res
            except Exception as e:
                print(f"[Avertissement] NVIDIA ({i+1}) a échoué : {str(e)[:50]}")

    if _groq_fallback:
        try:
            res = _groq_fallback.invoke(prompt)
            if res.content: return res
        except Exception as e:
            print(f"[Avertissement] Groq Fallback a échoué : {str(e)[:50]}")

    raise RuntimeError("Tous les modèles IA ont échoué. Vérifiez vos quotas/clés.")

# --- Expert Code : Qwen 2.5 Coder ---
try:
    llm_expert = HuggingFaceEndpoint(
        repo_id="Qwen/Qwen2.5-Coder-32B-Instruct",
        huggingfacehub_api_token=os.getenv("HUGGINGFACEHUB_API_TOKEN"),
        temperature=0.1,
        max_new_tokens=4096
    )
    code_expert_model = ChatHuggingFace(llm=llm_expert)
except:
    code_expert_model = None

_embeddings = HuggingFaceEmbeddings(model_name="intfloat/multilingual-e5-small")
vectorstore = Chroma(persist_directory="./data/chroma_db", embedding_function=_embeddings)

# ============================================================
# 2. Utilitaires
# ============================================================

def _ensure_dict(data) -> dict:
    if isinstance(data, dict): return data
    try: return json_repair.loads(str(data))
    except: return {}

def _clean_json(raw) -> str:
    content = raw.content if hasattr(raw, 'content') else str(raw)
    content = content.strip()
    if "```json" in content: content = content.split("```json")[1].split("```")[0]
    elif "```" in content: content = content.split("```")[1].split("```")[0]
    return content.strip()

def _safe_content(val) -> str:
    if isinstance(val, dict): return "\n\n".join([str(v) for v in val.values()])
    if isinstance(val, list): return "\n\n".join([str(v) for v in val])
    return str(val).replace('\\n', '\n').strip()

def _word_count(text) -> int:
    return len(str(text).split())

# ============================================================
# 3. Noeud Principal
# ============================================================

def writer_node(state: AgentState):
    lang = state.get("programming_language", "Python")
    age = state.get("age_group", 12)
    level = state.get("level", "BEGINNER")
    feedback = state.get("teacher_feedback", "")
    initial_prompt = state.get("initial_prompt", "")
    module_feedbacks = state.get("module_feedbacks", {})
    internal_secret = state.get("internal_secret", os.getenv("INTERNAL_AI_SECRET", "votre-secret-2026"))

    print(f"[Redacteur] Sophie Chen : Rédaction de {lang} (Recyclage & Anti-Paresse)...")

    # [CORRECTION] Extraction ciblée des modules réellement défaillants (Trop courts ou vides)
    too_short_titles = set(re.findall(r"'([^']+)'\s*\[TROP COURT", feedback)) if feedback else set()
    vides_titles = set(re.findall(r"'([^']+)'\s*\[VIDE", feedback)) if feedback else set()
    blacklist = too_short_titles.union(vides_titles).union(module_feedbacks.keys())

    syllabus = _ensure_dict(state.get("syllabus", "{}"))
    previous_course_data = {"modules": []}
    if state.get("content"):
        try: previous_course_data = _ensure_dict(state["content"][-1])
        except: pass

    course_data = {"courseTitle": syllabus.get("courseTitle", "Cours"), "modules": [], "final_project": {}}
    global_source_docs_info = []

    # ============================================================
    # [TELEMETRIE 1] : Démarrage du Rédacteur (35%)
    # ============================================================
    total_modules = len(syllabus.get("modules", []))
    if state.get("draft_id"):
        try:
            requests.patch(
                f"http://localhost:3000/api/ai/internal/drafts/{state['draft_id']}/progress",
                json={"progressPercent": 35, "agent_status": f"✍️ [Rédacteur] Début de la rédaction des {total_modules} chapitres..."},
                headers={"x-ai-secret": internal_secret}, timeout=3
            )
        except: pass

    for index, mod_raw in enumerate(syllabus.get("modules", [])):
        mod = _ensure_dict(mod_raw)
        mod_title = mod.get("title", f"Module {index + 1}")
        
        # ============================================================
        # [TELEMETRIE 2] : Mise à jour en temps réel par module (35% -> 80%)
        # ============================================================
        current_percent = int(35 + (index / max(1, total_modules)) * 45)
        if state.get("draft_id"):
            try:
                requests.patch(
                    f"http://localhost:3000/api/ai/internal/drafts/{state['draft_id']}/progress",
                    json={
                        "progressPercent": current_percent, 
                        "agent_status": f"✍️ [Rédacteur] Rédaction du module {index + 1}/{total_modules} : {mod_title[:30]}..."
                    },
                    headers={"x-ai-secret": internal_secret}, timeout=2
                )
            except: pass

        # --- LOGIQUE DE RECYCLAGE INTELLIGENT ---
        prev_mod = next((pm for pm in previous_course_data.get("modules", []) if _ensure_dict(pm).get("title") == mod_title), None)
        
        if prev_mod:
            prev_mod = _ensure_dict(prev_mod)
            wc = _word_count(prev_mod.get("content", ""))
            
            # On réutilise si : pas dans la blacklist de longueur ET longueur correcte (> 800 mots)
            if mod_title not in blacklist and wc > 800:
                print(f"    [Recycle Chirurgical] : {mod_title} ({wc} mots)")
                course_data["modules"].append(prev_mod)
                continue

        print(f"    [Generation] : {mod_title}")

        # --- Micro-RAG ---
        try:
            target_ids = [str(i) for i in state.get("course_ids", [])]
            search_filter = {"course_id": {"$in": target_ids}} if target_ids else None
            docs = vectorstore.similarity_search(mod_title, k=6, filter=search_filter)
            context = "\n\n".join([f"[{d.metadata.get('source_name')}, P.{d.metadata.get('page')}] {d.page_content}" for d in docs])
            global_source_docs_info.append({"module": mod_title, "sources": list(set(d.metadata.get("source_name") for d in docs))})
        except:
            context = "Expertise générale."
            global_source_docs_info.append({"module": mod_title, "sources": ["Expertise générale"]})

        # --- Loop Meilleure Tentative (Avec Anti-Paresse) ---
        mod_best = None
        max_wc_found = 0
        prev_text = f"\nVERSION ACTUELLE :\n{prev_mod.get('content', '')[:1000]}" if (prev_mod and mod_title in blacklist) else ""
        
        for attempt in range(3):
            try:
                current_prompt = get_writer_module_prompt(
                    age=age, level=level, initial_prompt=initial_prompt,
                    mod_title=mod_title, lang=lang, context=context,
                    specific_feedback=module_feedbacks.get(mod_title, feedback),
                    prev_text_context=prev_text, index=index, attempt=attempt
                )
                
                # 🚀 LOGIQUE ANTI-PARESSE
                if attempt == 1:
                    current_prompt += "\n\n⚠️ CRITIQUE : Ton essai précédent était BEAUCOUP TROP COURT. Tu dois ABSOLUMENT développer chaque point en profondeur. Vise au minimum 800 mots. Ajoute des explications détaillées."
                elif attempt == 2:
                    current_prompt += "\n\n🚨 ALERTE : C'est ton dernier essai. Ton texte doit être EXTRÊMEMENT LONG ET DÉTAILLÉ. Ne résume absolument rien. Vise 1000 mots."

                # 🧠 MIXTURE OF EXPERTS : On bascule sur Llama 70B (Groq) au 3ème essai si Nemotron est fainéant
                if attempt == 2 and _groq_fallback:
                    print(f"       Essai {attempt+1}/3 : Basculement sur Llama 3.3 70B (Groq) pour forcer la longueur...")
                    res = _groq_fallback.invoke(current_prompt)
                else:
                    print(f"       Essai {attempt+1}/3 : Utilisation de NVIDIA Mistral Nemotron...")
                    res = _invoke_with_fallback(current_prompt)

                cand = _ensure_dict(json_repair.loads(_clean_json(res)))
                if not cand or "content" not in cand: continue

                cand["content"] = _safe_content(cand.get("content", ""))
                wc = _word_count(cand["content"])
                print(f"       -> Résultat : {wc} mots")
                
                # Mise à jour du meilleur candidat (le plus long)
                if wc > max_wc_found:
                    max_wc_found = wc
                    mod_best = cand
                
                # On accepte le module dès qu'il atteint 850 mots pour éviter de boucler pour rien
                if wc >= 850: 
                    break 
            except Exception as e:
                print(f"       [Avertissement] Erreur Essai {attempt+1} : {e}")

        # Sauvegarde sécurisée
        if mod_best and mod_best.get("content"):
            course_data["modules"].append(mod_best)

    return {
        "content": [json.dumps(course_data, ensure_ascii=False)],
        "source_documents": global_source_docs_info
    }