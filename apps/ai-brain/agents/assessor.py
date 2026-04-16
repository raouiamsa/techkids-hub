import os
import json
import requests
from langchain_groq import ChatGroq
from dotenv import load_dotenv
from .state import AgentState

load_dotenv()

# --- Configuration du Modèle ---
# LLaMA 3.3 70B : Choisi pour sa précision dans la génération de QCM et sa logique de distraction
model = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.3 
)

def _clean_json(raw: str) -> str:
    """ Nettoie le bloc JSON renvoyé par l'IA pour extraire uniquement la donnée brute. """
    raw = raw.strip()
    if "```json" in raw: 
        raw = raw.split("```json")[1].split("```")[0]
    elif "```" in raw: 
        raw = raw.split("```")[1].split("```")[0]
    return raw.strip()

def assessor_node(state: AgentState):
    """
    Nœud Évaluateur : Génère le test de placement (initial) 
    ET l'examen final de certification (20 questions).
    """
    print("🎓 Évaluateur : Génération des examens (Diagnostic + Certification)...")

    # Récupération des paramètres contextuels depuis le State
    age = state.get("age_group", 12)
    language = state.get("programming_language", "Python")
    syllabus = state.get("syllabus", "{}")

    prompt = f"""
Tu es un Expert en Évaluation Pédagogique spécialisé dans les technologies STEM pour les enfants de {age} ans.
Ta mission est de générer deux banques de questions distinctes basées sur la technologie : {language}.

SYLLABUS DU COURS :
{syllabus}

LIVRABLES ATTENDUS (JSON STRICT) :
1. PLACEMENT_BANK : 10 questions simples pour évaluer les pré-requis avant de commencer.
2. CERTIFICATION_BANK : 20 questions couvrant l'ensemble du syllabus pour valider l'obtention du diplôme final.

RÈGLES DE RÉDACTION :
- Langage technique obligatoire : {language}.
- Structure QCM : 1 bonne réponse et 3 distracteurs (mauvaises réponses) crédibles.
- Chaque question doit avoir un ID unique (ex: p1, p2... pour placement, c1, c2... pour certif).
- Inclus une explication pédagogique claire pour chaque réponse.

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
        # Appel au moteur d'intelligence Groq
        response = model.invoke(prompt)
        
        # Nettoyage du Markdown et transformation en dictionnaire Python
        data = json.loads(_clean_json(response.content))
        
        # Télémétrie : Mise à jour de la progression (85%) au Hub NestJS
        draft_id = state.get("draft_id")
        if draft_id:
            try:
                # Notification asynchrone du Hub pour l'interface utilisateur
                requests.patch(
                    f"http://localhost:3000/api/ai/internal/drafts/{draft_id}/progress", 
                    json={"progressPercent": 85}
                )
            except Exception as e:
                print(f"⚠️ Évaluateur : Erreur de notification de progression : {e}")
            
        # On retourne les deux banques sérialisées en JSON pour le State de LangGraph
        return {
            "placement_bank": json.dumps(data.get("placement_bank", [])),
            "certification_bank": json.dumps(data.get("certification_bank", []))
        }
        
    except Exception as e:
        print(f"❌ Erreur critique dans l'Assesseur : {e}")
        # En cas d'échec de parsing, on renvoie des banques vides pour ne pas bloquer le pipeline
        return {"placement_bank": "[]", "certification_bank": "[]"}