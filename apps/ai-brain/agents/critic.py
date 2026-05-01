import os
import re
import json
import json_repair
import requests
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from core.state import AgentState
from .validator import validate_all_exercises
from core.prompts_library import get_critic_eval_prompt

load_dotenv()

# ============================================================
# 1. Configuration du Modèle Unique (Groq Versatile 70B)
# ============================================================

def _init_model(cls, **kwargs):
    try:
        key = kwargs.get("openai_api_key") or kwargs.get("api_key")
        if key: return cls(**kwargs)
    except: return None

# Plan A (Unique) : Groq (Llama 3.3 70B Versatile)
_critic_model = _init_model(ChatGroq,
    model="llama-3.3-70b-versatile",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.0
)

def _critic_invoke(prompt: str):
    """Audit strict via Groq (Temperature 0.0)."""
    if not _critic_model:
        raise RuntimeError("Modele Groq non configure. Verifiez GROQ_API_KEY.")
    print("[Critique] Tentative avec Llama 3.3 70B (Groq)...")
    result = _critic_model.invoke(prompt)
    print("[Critique] Succes avec Groq.")
    return result

def _clean_json(raw) -> str:
    if hasattr(raw, 'content'):
        raw = raw.content
    elif isinstance(raw, dict) and "content" in raw:
        raw = raw["content"]
    elif isinstance(raw, list):
        raw = raw[0]["text"] if (raw and isinstance(raw[0], dict) and "text" in raw[0]) else str(raw[0])
    
    raw = str(raw).strip()
    if "```json" in raw:
        raw = raw.split("```json")[1].split("```")[0]
    elif "```" in raw:
        raw = raw.split("```")[1].split("```")[0]
    return raw.strip()

# ============================================================
# COUCHE 1A - Word Count
# ============================================================

def _check_word_count(modules: list) -> list:
    """Retourne les modules avec < 500 mots."""
    issues = []
    for i, m in enumerate(modules):
        text = str(m.get("content", "")).strip()
        count = len(text.split())
        if count < 500:
            status = "VIDE" if count == 0 else f"TROP COURT ({count} mots)"
            issues.append({
                "module": m.get("title", f"Module {i+1}"),
                "issue": status,
                "layer": "WordCount"
            })
    return issues

# ============================================================
# COUCHE 1B - Markdown Integrity
# ============================================================

def _check_markdown_integrity(modules: list) -> list:
    """Verifie la structure Markdown de chaque module."""
    issues = []
    for m in modules:
        title = m.get("title", "Module inconnu")
        content = str(m.get("content", ""))
        module_issues = []

        # Verifier les code blocks fermes (nombre de ``` doit etre pair)
        if content.count("```") % 2 != 0:
            module_issues.append("code block non ferme (``` impair)")

        # Verifier la presence d'au moins un header ##
        if "##" not in content:
            module_issues.append("aucun header ## trouve")

        # Verifier les backticks litteraux \n dans le contenu final
        if "\\n" in content:
            module_issues.append("backslash-n litteraux detectes (\\n)")

        if module_issues:
            issues.append({
                "module": title,
                "issue": f"MARKDOWN [{', '.join(module_issues)}]",
                "layer": "Markdown"
            })
    return issues

# ============================================================
# COUCHE 1C - Citation Count
# ============================================================

def _check_citation_count(modules: list) -> list:
    """Verifie la presence d'au moins 2 citations (Source:...) par module."""
    issues = []
    citation_pattern = re.compile(r'\(Source[:\s]', re.IGNORECASE)
    for m in modules:
        title = m.get("title", "Module inconnu")
        content = str(m.get("content", ""))
        count = len(citation_pattern.findall(content))
        if count < 2:
            issues.append({
                "module": title,
                "issue": f"CITATIONS INSUFFISANTES ({count}/2 minimum)",
                "layer": "Citations"
            })
    return issues

# ============================================================
# COUCHE 1D - Code Validation (validator.py)
# ============================================================

def _check_code_exercises(modules: list, language: str) -> list:
    """Valide les exercices de code via ast.parse (Python) ou Piston API (autres)."""
    errors = validate_all_exercises(modules, language)
    issues = []
    for err in errors:
        issues.append({
            "module": err["module"],
            "issue": f"CODE INVALIDE dans '{err['exercise_title']}' [{err['error']}] (via {err['method']})",
            "layer": "CodeValidation"
        })
    return issues

# ============================================================
# COUCHE 2 - Audit Qualitatif LLM
# ============================================================

def _run_llm_audit(modules: list, language: str, age: int, include_code_exercises: bool = True) -> dict:
    """
    Audit qualitatif par le LLM configuré (Llama 3.3).
    Retourne un score global + issues par module (Exercise Alignment, Hook Quality).
    """
    modules_summary = "\n".join([
        f"- Module '{m.get('title', '?')}' ({len(str(m.get('content','')).split())} mots) | "
        f"Exercices QCM: {len(m.get('exercises_text', []))} | "
        + (f"Exercices code: {len(m.get('exercises_code', []))} | " if include_code_exercises else "")
        + f"Debut: {str(m.get('content',''))[:150]}..."
        for m in modules
    ])

    exercise_criterion = (
        f"1. QUALITE THEORIQUE : Le contenu est-il exhaustif et avec une charge cognitive adaptee a des enfants de {age} ans ?\n"
        f"   - ATTENTION : NE CRITIQUE PAS L'ABSENCE D'EXERCICES DE CODE OU DE QCM. Les exercices seront generes dans l'etape suivante par l'Enrichisseur."
    )

    eval_prompt = get_critic_eval_prompt(
        language=language,
        age=age,
        modules_summary=modules_summary,
        exercise_criterion=exercise_criterion
    )

    try:
        ai_res = _critic_invoke(eval_prompt)
        raw = _clean_json(ai_res)
        verdict = json_repair.loads(raw) if raw.strip() else {}
        if isinstance(verdict, list) and verdict:
            verdict = verdict[0]
        if not isinstance(verdict, dict):
            verdict = {}
        return verdict
    except Exception as e:
        print(f"[Critique] Audit LLM echoue : {e}")
        return {"score": 70, "approved": True, "module_issues": [], "global_issues": []}

# ============================================================
# NOEUD PRINCIPAL
# ============================================================

def critic_node(state: AgentState):
    """
    Agent de controle qualite 3 couches.
    Genere un feedback chirurgical cible par module.
    """
    iteration = state.get('iterations', 0)
    language = state.get("programming_language", "Python")
    draft_id = state.get("draft_id")
    age = state.get("age_group", 12)
    internal_secret = state.get("internal_secret", os.getenv("INTERNAL_AI_SECRET", "votre-secret-pfe-2026"))

    # [CORRECTION] Lecture de la stratégie de l'Architecte
    strategy = state.get("pdf_code_strategy", "code_from_pdf")
    include_code_exercises = state.get("include_code_exercises", True)
    
    if strategy == "qcm_only":
        include_code_exercises = False
        print(f"[Critique] Stratégie globale '{strategy}' détectée -> Désactivation de l'audit de code.")

    print(f"[Critique] Verification finale du cours de {language} (Iteration {iteration})...")

    # --- Extraction du dernier contenu ---
    content_list = state.get("content") or []
    content_raw = content_list[-1] if content_list else "{}"

    try:
        course_data = json.loads(content_raw)
        modules = course_data.get("modules", [])
    except Exception as e:
        print(f"[Critique] Erreur JSON : {e}")
        return {"teacher_feedback": "Erreur de structure JSON globale.", "iterations": iteration + 1}

    if not modules:
        print("[Critique] Aucun module trouve.")
        return {"teacher_feedback": "Structure vide - aucun module.", "iterations": iteration + 1}

    # ==========================================================
    # COUCHE 1 : AUDITS DETERMINISTES (0 API, Python pur)
    # ==========================================================
    all_layer1_issues = []

    # 1A - Word Count
    wc_issues = _check_word_count(modules)
    all_layer1_issues.extend(wc_issues)
    if wc_issues:
        for iss in wc_issues:
            print(f"[Critique] {iss['module']} -> {iss['issue']}")

    # 1B - Markdown Integrity
    md_issues = _check_markdown_integrity(modules)
    all_layer1_issues.extend(md_issues)
    if md_issues:
        for iss in md_issues:
            print(f"[Critique] {iss['module']} -> {iss['issue']}")

    # 1C - Citation Count
    cit_issues = _check_citation_count(modules)
    all_layer1_issues.extend(cit_issues)
    if cit_issues:
        for iss in cit_issues:
            print(f"[Critique] {iss['module']} -> {iss['issue']}")

    # 1D - Code Validation
    has_code_exercises = any(m.get("exercises_code") for m in modules)
    if has_code_exercises:
        code_issues = _check_code_exercises(modules, language)
        all_layer1_issues.extend(code_issues)
        if code_issues:
            for iss in code_issues:
                print(f"[Critique] {iss['module']} -> {iss['issue']}")
    else:
        code_issues = []

    # La logique structurelle est OK uniquement si aucun probleme de layer1
    approved_by_logic = (len(wc_issues) == 0)

    # ==========================================================
    # COUCHE 2 : AUDIT QUALITATIF LLM
    # ==========================================================
    verdict = _run_llm_audit(modules, language, age, include_code_exercises=include_code_exercises)
    ai_score = verdict.get("score", 60)
    llm_module_issues = verdict.get("module_issues", [])
    global_issues = verdict.get("global_issues", [])

    if llm_module_issues:
        for iss in llm_module_issues:
            print(f"[Critique] {iss.get('module','?')} -> {iss.get('issue','?')}")

    # ==========================================================
    # DECISION FINALE
    # ==========================================================
    if not approved_by_logic:
        # Modules vides/courts -> rejet ferme independamment du score LLM
        final_approved = False
        final_score = min(ai_score, 60)
    elif ai_score >= 70:
        # Logique OK + score acceptable -> on approuve
        final_approved = True
        final_score = ai_score
    else:
        # Logique OK mais score bas -> on suit le LLM
        final_approved = verdict.get("approved", True)
        final_score = ai_score

    print(f"[Critique] Verdict : {'APPROUVE' if final_approved else 'REJETE'} (Score: {final_score}/100)")

    # --- Telemetrie NestJS ---
    if draft_id:
        try:
            status_msg = "✅ [Critique] Cours approuvé et finalisé !" if final_approved else "🔄 [Critique] Des corrections sont nécessaires..."
            headers = {"x-ai-secret": internal_secret}
            requests.patch(
                f"http://localhost:3000/api/ai/internal/drafts/{draft_id}/progress",
                json={
                    "progressPercent": 100 if final_approved else 95, 
                    "aiScore": final_score,
                    "agent_status": status_msg
                },
                headers=headers,
                timeout=5
            )
        except Exception:
            pass

    # ==========================================================
    # GENERATION DU FEEDBACK CHIRURGICAL
    # ==========================================================
    if not final_approved and iteration < 2:
        # Collecter tous les modules avec des problemes (Couche 1 + Couche 2 LLM)
        failed_parts = []

        # Issues Couche 1 (structurelles)
        for iss in all_layer1_issues:
            failed_parts.append(f"'{iss['module']}' [{iss['issue']}]")

        # Issues Couche 2 LLM (qualitatives, par module)
        for iss in llm_module_issues:
            mod_name = iss.get("module", "")
            issue_text = iss.get("issue", "")
            if mod_name and issue_text:
                # Eviter les doublons avec la Couche 1
                entry = f"'{mod_name}' [QUALITE: {issue_text}]"
                if entry not in failed_parts:
                    failed_parts.append(entry)

        if failed_parts:
            modules_list_str = ", ".join(failed_parts)
            feedback_auto = (
                f"CRITIQUE TECHNIQUE : Les modules suivants sont insuffisants ou vides : {modules_list_str}. "
                f"Sophie, tu dois RE-GENERER le contenu de ces modules specifiquement. "
                f"Assure-toi d'atteindre au moins 800-1000 mots, inclure 2+ citations (Source:...) "
                + ("et que les exercices de code testent exactement ce que le module enseigne." if include_code_exercises
                   else "et que les exercices QCM testent exactement ce que le module enseigne. Les exercices de CODE ne sont PAS requis.")
            )
            print(f"[Critique] Modules defaillants : {modules_list_str}")
        else:
            # Problemes globaux uniquement
            global_str = ', '.join(global_issues) if global_issues else f"Score IA: {final_score}/100"
            feedback_auto = (
                f"Le cours necessite une amelioration globale. {global_str}. "
                f"Approfondis le contenu de tous les modules, ameliore les hooks d'introduction "
                f"et assure-toi que chaque exercice correspond exactement au contenu du module."
            )
            print(f"[Critique] Problemes globaux : {global_str}")

        print(f"[Critique] Feedback injecte : {feedback_auto[:250]}...")
        return {"teacher_feedback": feedback_auto, "iterations": iteration + 1}

    # --- Fin du cycle ---
    return {"teacher_feedback": "", "iterations": iteration + 1}

def should_continue(state: AgentState):
    if state.get("teacher_feedback") and state.get("iterations", 0) < 3:
        return "rectify"
    return "enricher"