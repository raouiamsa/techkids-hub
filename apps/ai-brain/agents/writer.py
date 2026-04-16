import os
import json
import requests
from langchain_groq import ChatGroq
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from dotenv import load_dotenv
from .state import AgentState

load_dotenv()

# --- Configuration des Modèles (Basée sur la liste Groq mise à jour) ---

# ✍️ LLAMA 3.3 70B : Pour la narration pédagogique, la densité et le ton
text_model = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.6 
)

# 💻 QWEN 3 32B : L'expert pour générer du code et des solutions sans erreurs
code_expert_model = ChatGroq(
    model="qwen/qwen3-32b",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.1 
)

# Initialisation des Embeddings pour la recherche RAG
_embeddings = HuggingFaceEmbeddings(
    model_name="intfloat/multilingual-e5-small",
    model_kwargs={"device": "cpu"},
    encode_kwargs={"normalize_embeddings": True}
)

# Connexion à la base de données vectorielle locale
vectorstore = Chroma(persist_directory="./data/chroma_db", embedding_function=_embeddings)


def _clean_json(raw: str) -> str:
    """ Nettoie la réponse de l'IA pour extraire uniquement le bloc JSON pur. """
    raw = raw.strip()
    if "```json" in raw:
        raw = raw.split("```json")[1].split("```")[0]
    elif "```" in raw:
        raw = raw.split("```")[1].split("```")[0]
    return raw.strip()


def _generate_code_exercises(module_title: str, module_content: str, age_group: int, language: str) -> list:
    """ Appelle l'expert code pour créer des défis et leurs SOLUTIONS commentées. """
    prompt = f"""Tu es un tuteur expert en {language} pour des enfants de {age_group} ans.
Pour le module "{module_title}", génère 2 exercices de programmation interactifs.

CONTEXTE DU COURS : {module_content[:500]}

RÈGLES STRICTES :
- Langage obligatoire : {language}
- TU DOIS FOURNIR LA SOLUTION COMPLÈTE ET COMMENTÉE pour chaque exercice.
- Format JSON (tableau d'objets) uniquement : [{{ "title", "instructions", "starterCode", "solution", "hints" }}]
"""
    try:
        response = code_expert_model.invoke(prompt)
        clean = _clean_json(response.content)
        return json.loads(clean)
    except Exception as e:
        print(f"❌ Erreur Expert Code ({language}) : {e}")
        return []


def writer_node(state: AgentState):
    """
    Nœud Rédacteur : Sophie Chen rédige un contenu massif, pédagogique et sourcé.
    Elle inclut désormais le Projet Final et les corrigés détaillés.
    """
    lang = state.get("programming_language", "Python")
    print(f"✍️ Rédacteur : Sophie Chen rédige le cours riche de {lang} avec citations...")

    # --- RAG : Recherche par similarité (k=15 pour une richesse maximale) ---
    syllabus_str = state['syllabus'] if isinstance(state['syllabus'], str) else json.dumps(state['syllabus'])
    query = f"Détails pédagogiques exhaustifs et concepts pour : {syllabus_str[:400]}"
    
    docs = vectorstore.similarity_search(
        query,
        k=15,
        filter={"course_id": {"$in": state['course_ids']}}
    )

    # --- Préparation du Contexte enrichi avec Métadonnées (Citations) ---
    context_parts = []
    source_docs_info = []
    for d in docs:
        name = d.metadata.get("source_name", "Source")
        # Gestion Page (PDF) vs Timestamp (Vidéo)
        location = f"Page {d.metadata.get('page')}" if d.metadata.get('page') else f"Temps {d.metadata.get('timestamp')}"
        ref_id = f"[{name}, {location}]"
        
        context_parts.append(f"{ref_id}: {d.page_content}")
        source_docs_info.append({"ref": ref_id, "content": d.page_content[:200]})

    context = "\n\n".join(context_parts)
    feedback_str = f"\nDIRECTIVES PROFESSEUR : {state.get('teacher_feedback')}" if state.get('teacher_feedback') else ""

    # --- Prompt Sophie Chen v2 : DENSITÉ, CITATIONS et PROJET FINAL ---
    llama_prompt = f"""Tu es Sophie Chen, rédactrice tech pour enfants de {state['age_group']} ans.
Ta mission : Créer un cours passionnant, TRÈS DÉTAILLÉ et SOURCÉ.

LANGAGE : {lang} | NIVEAU : {state.get('level')}

SOURCES DOCUMENTAIRES AVEC RÉFÉRENCES :
{context}

SYLLABUS ET DIRECTIVES :
{syllabus_str}
{feedback_str}

CONSIGNES DE RÉDACTION STRICTES :
1. DENSITÉ : Chaque module doit être riche (environ 1000 mots). Ne résume pas, explique chaque concept avec des analogies.
2. CITATIONS OBLIGATOIRES : Cite tes sources au format "(Source: Nom, Page/Temps)" dès qu'une information vient des documents.
3. PROJET FINAL : Conçois un projet de synthèse captivant à la fin du cours (énoncé, étapes, conseils).
4. FORMAT : Réponds uniquement en JSON STRICT.

STRUCTURE JSON REQUISE :
{{
  "courseTitle": "Titre du cours",
  "modules": [
    {{
      "order": 1,
      "title": "Titre du module",
      "content": "Contenu Markdown exhaustif incluant les citations...",
      "summary": "Résumé rapide du module",
      "exercises_text": [ {{ "question": "...", "options": [], "answer": "...", "explanation": "..." }} ]
    }}
  ],
  "finalProject": {{
     "title": "Nom du Projet",
     "description": "Énoncé complet et motivant",
     "steps": ["Étape 1", "Étape 2"],
     "solution_hint": "Guide de réussite pour le professeur"
  }}
}}
"""

    response = text_model.invoke(llama_prompt)
    try:
        course_data = json.loads(_clean_json(response.content))
    except Exception as e:
        print(f"❌ Erreur de parsing JSON (Sophie Chen) : {e}")
        course_data = {"courseTitle": "Erreur de génération", "modules": [], "finalProject": {}}

    # --- Injection des exercices de code et des SOLUTIONS (Expert Qwen 3) ---
    if state.get('include_code_exercises') and "modules" in course_data:
        print(f"💻 Expert Code : Génération des défis et des solutions en {lang}...")
        for module in course_data["modules"]:
            module["exercises_code"] = _generate_code_exercises(
                module.get("title", ""), 
                module.get("content", ""), 
                state['age_group'],
                lang
            )
    else:
        for module in course_data.get("modules", []):
            module["exercises_code"] = []

    # --- Webhook de télémétrie : Notification de progression (60%) ---
    draft_id = state.get("draft_id")
    if draft_id:
        try:
            requests.patch(
                f"http://localhost:3000/api/ai/internal/drafts/{draft_id}/progress",
                json={"progressPercent": 60}
            )
        except: pass

    # On retourne le contenu complet et le projet final pour l'état global
    return {
        "content": [json.dumps(course_data, ensure_ascii=False)],
        "final_project": json.dumps(course_data.get("finalProject", {})),
        "source_documents": source_docs_info
    }