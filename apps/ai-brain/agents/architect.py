import os
import json
import json_repair
import requests
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from langchain_nvidia_ai_endpoints import ChatNVIDIA
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from dotenv import load_dotenv
from core.state import AgentState
from core.prompts_library import get_architect_prompt

load_dotenv()

# ============================================================
# 1. Configuration des Modèles
# ============================================================

def _init_model(cls, **kwargs):
    try:
        key = kwargs.get("openai_api_key") or kwargs.get("api_key") or kwargs.get("nvidia_api_key")
        if key: 
            return cls(**kwargs)
    except Exception as e:
        print(f"[Avertissement] Echec de l'initialisation pour {cls}: {e}")
    return None

# Plan A (Unique) : Groq (Llama 3.3 70B Versatile)
_architect_model = _init_model(ChatGroq,
    model="llama-3.3-70b-versatile",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.3
)

def _invoke_with_fallback(prompt: str):
    # Execution avec Groq 
    if not _architect_model:
        raise RuntimeError("Modele Groq non configure. Verifiez GROQ_API_KEY.")
    print("[Architecte] Tentative avec Llama 3.3 70B (Groq)...")
    res = _architect_model.invoke(prompt)
    if res.content and len(res.content.strip()) > 10:
        print("[Architecte] Succes avec Groq.")
        return res
    raise RuntimeError("Le modele Groq a renvoye une reponse vide.")

# 2. Configuration du RAG
_embeddings = HuggingFaceEmbeddings(
    model_name="intfloat/multilingual-e5-small",
    model_kwargs={"device": "cpu"},
    encode_kwargs={"normalize_embeddings": True}
)
vectorstore = Chroma(persist_directory="./data/chroma_db", embedding_function=_embeddings)

# ============================================================
# 3. Noeud Principal (Architect Node)
# ============================================================

def architect_node(state: AgentState):
    
    # 1. 🛡️ VÉRIFICATION ROBUSTE DU SYLLABUS EXISTANT
    raw_syllabus = state.get("syllabus", "")
    existing_syllabus_str = ""
    
    # Gère le cas où le state contient un dictionnaire ou un string (FastAPI parsing)
    if isinstance(raw_syllabus, dict):
        existing_syllabus_str = json.dumps(raw_syllabus, ensure_ascii=False)
    elif isinstance(raw_syllabus, str):
        existing_syllabus_str = raw_syllabus.strip()
        
    has_approved_syllabus = bool(existing_syllabus_str and existing_syllabus_str not in ("{}", "[]", '""', "null", "None"))

    if has_approved_syllabus:
        print("✅ [Architecte] Syllabus approuvé détecté -> Bypass de la conception IA.")
    else:
        print("🧠 [Architecte] Analyse du sujet et conception d'un nouveau plan de cours en cours...")

    feedback_str = f"\n DIRECTIVES SUPPLEMENTAIRES : {state.get('teacher_feedback')}" if state.get('teacher_feedback') else ""

    # 2. 🔍 DIAGNOSTIC (DOIT TOUJOURS TOURNER POUR CONFIGURER LE RÉDACTEUR)
    print("[Architecte] Lecture des fichiers sources en cours...")
    try:
        if state.get("course_ids"):
            docs = vectorstore.similarity_search(state['input_request'], k=8, filter={"course_id": {"$in": state['course_ids']}})
            if not docs:
                print("[Avertissement] Aucun resultat trouve avec l'ID -> Recherche globale")
                docs = vectorstore.similarity_search(state['input_request'], k=8)
        else:
            docs = vectorstore.similarity_search(state['input_request'], k=8)
        context = "\n".join([doc.page_content for doc in docs])
        if docs:
            print(f"[RAG] {len(docs)} fragments trouves comme contexte")
    except Exception as e:
        print(f"[Avertissement] Erreur RAG ({e}). Activation du mode sans contexte.")
        context = ""
        docs = []

    # Diagnostic du code source dans les fichiers
    code_indicators = ['def ', 'import ', 'print(', 'for ', 'while ',
                       'class ', 'return ', '= [', '= {', '(self)',
                       'function(', 'var ', 'const ', 'let ', '#include',
                       'public static', '<?php', '#!/', '():']
    has_code_in_pdf = False
    total_scanned = 0

    try:
        collection = vectorstore._collection
        get_kwargs = {"limit": 100, "include": ["documents"]}
        if state.get("course_ids"):
            get_kwargs["where"] = {"course_id": {"$in": state['course_ids']}}
        result = collection.get(**get_kwargs)
        raw_docs = result.get("documents", []) or []
        all_text = " ".join([str(d) for d in raw_docs if d])
        total_scanned = len(raw_docs)
        code_hits = sum(1 for ind in code_indicators if ind in all_text)
        has_code_in_pdf = code_hits >= 3
        print(f"[Scan Direct] {total_scanned} fragments | occurrences de code={code_hits} | code_present={has_code_in_pdf}")

    except Exception as e1:
        print(f"[Avertissement] Scan direct indisponible ({type(e1).__name__}) -> Activation du fallback RAG...")
        try:
            all_text = context
            code_filter = {"course_id": {"$in": state['course_ids']}} if state.get("course_ids") else None
            for q in ["code function def import class", "implementation algorithm example variable loop"]:
                try:
                    cdocs = vectorstore.similarity_search(q, k=15, filter=code_filter) if code_filter else vectorstore.similarity_search(q, k=15)
                    all_text += " ".join([d.page_content for d in cdocs])
                    total_scanned += len(cdocs)
                except Exception:
                    pass
            code_hits = sum(1 for ind in code_indicators if ind in all_text)
            has_code_in_pdf = code_hits >= 3
            print(f"[RAG Fallback] {total_scanned} fragments | occurrences de code={code_hits} | code_present={has_code_in_pdf}")
        except Exception as e2:
            print(f"[Avertissement] Echec du scan global ({e2}).")
            code_hits = sum(1 for ind in code_indicators if ind in context)
            has_code_in_pdf = code_hits >= 3

    # Identification du type de sujet
    input_lower = state['input_request'].lower()
    programming_keywords = ['python', 'javascript', 'java', 'c++', 'ruby', 'rust', 'go', 'kotlin',
                            'typescript', 'php', 'swift', 'arduino', 'scratch', 'coding', 'code',
                            'programmation', 'algorithmique', 'data science', 'machine learning',
                            'deep learning', 'devops', 'web dev', 'flask', 'django', 'react',
                            'sql', 'database', 'api', 'microservices', 'docker']
    math_keywords = ['mathematiques', 'algebre', 'geometrie', 'calcul', 'statistiques',
                     'trigonometr', 'probability', 'math', 'algebra', 'geometry']
    science_keywords = ['physique', 'chimie', 'biologie', 'sciences', 'physics', 'chemistry',
                        'biology', 'electronique', 'robotique', 'arduino hardware']
    theory_keywords = ['histoire', 'philosophie', 'litterature', 'geographie', 'droit',
                       'history', 'philosophy', 'literature', 'economics', 'economie']

    if any(kw in input_lower for kw in programming_keywords):
        subject_type = 'programming'
    elif any(kw in input_lower for kw in math_keywords):
        subject_type = 'math'
    elif any(kw in input_lower for kw in science_keywords):
        subject_type = 'science'
    elif any(kw in input_lower for kw in theory_keywords):
        subject_type = 'theory'
    else:
        subject_type = 'mixed'

    # Definition de la strategie des exercices
    if subject_type == 'programming':
        pdf_code_strategy = 'code_from_pdf' if has_code_in_pdf else 'code_from_llm'
    elif subject_type == 'math':
        pdf_code_strategy = 'calculation'
    elif subject_type == 'science':
        pdf_code_strategy = 'calculation'
    else:
        pdf_code_strategy = 'qcm_only'

    print(f"[Diagnostic final] type_sujet={subject_type} | code_present={has_code_in_pdf} | strategie={pdf_code_strategy}")

    # 3. 🚦 BIFURCATION (SAUT DE L'IA SI LE PLAN EST DÉJÀ APPROUVÉ)
    if has_approved_syllabus:
        # Extraire le langage depuis le syllabus existant
        detected_lang = "Python"
        try:
            data = json_repair.loads(existing_syllabus_str)
            if isinstance(data, dict):
                detected_lang = data.get("programmingLanguage", "Python")
        except: pass

        # On retourne le syllabus validé AVEC les stratégies calculées (Important pour la suite du pipeline !)
        return {
            "syllabus": existing_syllabus_str,
            "programming_language": state.get("programming_language", detected_lang),
            "subject_type": subject_type,
            "has_code_in_pdf": has_code_in_pdf,
            "pdf_code_strategy": pdf_code_strategy,
        }

    # 4. 🤖 CRÉATION DU NOUVEAU PLAN (SI AUCUN N'EST APPROUVÉ)
    exercise_mode_desc = {
        'code_from_pdf': '"code_from_pdf"  (utilise les exemples de code du PDF source)',
        'code_from_llm': '"code_from_llm"  (le LLM genere le code, inspire du contexte PDF)',
        'calculation':   '"calculation"    (exercices de calcul/formules mathematiques ou scientifiques)',
        'qcm_only':      '"qcm_only"       (uniquement des QCM, aucun code ni calcul)'
    }[pdf_code_strategy]

    prompt = get_architect_prompt(
        topic=state['input_request'],
        age_group=state['age_group'],
        level=state.get('level', 'BEGINNER'),
        subject_type=subject_type,
        exercise_mode_desc=exercise_mode_desc,
        feedback_str=feedback_str,
        context=context,
        pdf_code_strategy=pdf_code_strategy
    )
    
    # Appel a l'IA via la cascade
    response = _invoke_with_fallback(prompt)
    raw_content = response.content.strip()
    
    # ================================================================
    # Extraction et correction du JSON
    # ================================================================
    if "```json" in raw_content:
        start = raw_content.find("```json") + 7
        end   = raw_content.rfind("```")
        raw_content = raw_content[start:end] if end > start else raw_content[start:]
    elif "```" in raw_content:
        start = raw_content.find("```") + 3
        newline = raw_content.find("\n", start)
        if newline != -1:
            start = newline + 1
        end = raw_content.rfind("```")
        raw_content = raw_content[start:end] if end > start else raw_content[start:]
    
    clean_json = raw_content.strip()
    
    # Extraction du langage de programmation pour le reste du systeme
    detected_lang = "Python"
    try:
        data = json_repair.loads(clean_json)
        detected_lang = data.get("programmingLanguage", "Python")
    except Exception:
        print("[Avertissement] Erreur de lecture du JSON, utilisation de la langue par defaut.")

    # Envoi de la notification de progression (30%) a NestJS
    draft_id = state.get("draft_id")
    if draft_id:
        try:
            requests.patch(
                f"http://localhost:3000/api/ai/internal/drafts/{draft_id}/progress", 
                json={"progressPercent": 30}
            )
        except Exception as e:
            print(f"[Avertissement] Erreur lors de la mise a jour de la progression: {e}")

    # Retour du resultat
    return {
        "syllabus": clean_json,
        "programming_language": detected_lang,
        "subject_type": subject_type,
        "has_code_in_pdf": has_code_in_pdf,
        "pdf_code_strategy": pdf_code_strategy,
    }