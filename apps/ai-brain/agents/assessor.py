import os
import json
import json_repair
import requests
from langchain_groq import ChatGroq
from dotenv import load_dotenv
from core.state import AgentState

load_dotenv()

# ============================================================
# 1. Configuration des Modeles (Plan A:Groq)
# ============================================================

def _init_model(cls, **kwargs):
    try:
        key = kwargs.get("openai_api_key") or kwargs.get("api_key")
        if key:
            return cls(**kwargs)
    except Exception as e:
        print(f"[Avertissement] Echec de l'initialisation pour le modele {cls}: {e}")
    return None

# Plan A (Unique) : Groq (Llama 3.3 70B Versatile)
_assessor_model = _init_model(ChatGroq,
    model="llama-3.3-70b-versatile",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.3
)

def _invoke_with_fallback(prompt: str):
    """Execution avec Groq (Modele unique)."""
    if not _assessor_model:
        raise RuntimeError("Modele Groq non configure. Verifiez GROQ_API_KEY.")
    print("[Evaluateur] Tentative avec Llama 3.3 70B (Groq)...")
    res = _assessor_model.invoke(prompt)
    if res.content and len(res.content.strip()) > 10:
        print("[Evaluateur] Succes avec Groq.")
        return res
    raise RuntimeError("Le modele Groq a echoue.")

def _clean_json(raw) -> str:
    """ Nettoie le bloc JSON renvoye par l'IA pour extraire uniquement la donnee brute. """
    if hasattr(raw, 'content'):
        raw = raw.content
    elif isinstance(raw, dict) and "content" in raw:
        raw = raw["content"]
    elif isinstance(raw, list):
        if len(raw) > 0 and isinstance(raw[0], dict) and "text" in raw[0]:
            raw = raw[0]["text"]
        else:
            raw = str(raw[0])
            
    raw = str(raw).strip()
    if "```json" in raw: 
        raw = raw.split("```json")[1].split("```")[0]
    elif "```" in raw: 
        raw = raw.split("```")[1].split("```")[0]
    return raw.strip()

# ============================================================
# 2. Noeud Principal (Assessor Node)
# ============================================================

def assessor_node(state: AgentState):
    """
    Noeud Evaluateur : Genere le test de placement (initial) 
    ET l'examen final de certification (20 questions).
    """
    print("[Evaluateur] Generation des examens (Diagnostic + Certification)...")

    # Recuperation des parametres contextuels depuis le State
    age = state.get("age_group", 12)
    language = state.get("programming_language", "Python")
    syllabus = state.get("syllabus", "{}")
    
    # Donnees pour l'alignement pedagogique (Fine-tuning & Directives)
    initial_prompt = state.get("initial_prompt", "")
    feedback = state.get("teacher_feedback", "")
    
    internal_secret = state.get("internal_secret", os.getenv("INTERNAL_AI_SECRET", "votre-secret-pfe-2026"))

    prompt = f"""
Tu es un Expert en Evaluation Pedagogique specialise dans les technologies STEM pour les enfants de {age} ans.
Ta mission est de generer deux banques de questions distinctes basees sur la technologie : {language}.

CONTEXTE INITIAL DU COURS :
{initial_prompt}

DIRECTIVES ET FEEDBACK DU PROFESSEUR :
{feedback}

SYLLABUS DU COURS :
{syllabus}

LIVRABLES ATTENDUS (JSON STRICT) :
1. PLACEMENT_BANK : 10 questions simples pour evaluer les pre-requis avant de commencer.
2. CERTIFICATION_BANK : 20 questions couvrant l'ensemble du syllabus pour valider l'obtention du diplome final.

REGLES DE REDACTION :
- Langage technique obligatoire : {language}.
- Structure QCM : 1 bonne reponse et 3 distracteurs (mauvaises reponses) credibles.
- Chaque question doit avoir un ID unique (ex: p1, p2... pour placement, c1, c2... pour certif).
- Inclus une explication pedagogique claire pour chaque reponse.
- Les questions doivent IMPERATIVEMENT respecter les directives du professeur et s'adapter a l'age cible.

FORMAT JSON OBLIGATOIRE :
{{
  "placement_bank": [
    {{ "id": "p1", "question": "...", "options": ["A", "B", "C", "D"], "correct_answer": "...", "explanation": "..." }}
  ],
  "certification_bank": [
    {{ "id": "c1", "question": "...", "options": ["A", "B", "C", "D"], "correct_answer": "...", "explanation": "..." }}
  ]
}}
"""
    try:
        # Appel au moteur d'intelligence avec le systeme de fallback
        response = _invoke_with_fallback(prompt)
        
        # Nettoyage du Markdown et transformation en dictionnaire Python avec json_repair
        data = json_repair.loads(_clean_json(response))
        
        # Telemetrie : Mise a jour de la progression (85%) au Hub NestJS avec Agent Status
        draft_id = state.get("draft_id")
        if draft_id:
            try:
                headers = {"x-ai-secret": internal_secret}
                requests.patch(
                    f"http://localhost:3000/api/ai/internal/drafts/{draft_id}/progress", 
                    json={
                        "progressPercent": 85,
                        "agent_status": "📝 [Évaluateur] Génération des examens de certification et de placement..."
                    },
                    headers=headers,
                    timeout=5
                )
            except Exception as e:
                print(f"[Avertissement] Evaluateur : Erreur de notification de progression : {e}")
            
        # On retourne les deux banques serialisees en JSON pour le State de LangGraph
        return {
            "placement_bank": json.dumps(data.get("placement_bank", []), ensure_ascii=False),
            "certification_bank": json.dumps(data.get("certification_bank", []), ensure_ascii=False)
        }
        
    except Exception as e:
        print(f"[Erreur] Echec critique dans l'Evaluateur : {e}")
        # En cas d'echec de parsing, on renvoie des banques vides pour ne pas bloquer le pipeline
        return {"placement_bank": "[]", "certification_bank": "[]"}