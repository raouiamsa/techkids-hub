import os
import json
import requests
from langchain_groq import ChatGroq
from dotenv import load_dotenv
from .state import AgentState

load_dotenv()

# --- Configuration du Modèle ---
# LLaMA 3.3 70B : Choisi pour sa puissance de structuration et sa rapidité sur Groq
model = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.3
)

def architect_node(state: AgentState):
    """
    Nœud Architecte : Analyse la demande du professeur, détecte le langage 
    de programmation approprié et conçoit le plan (syllabus) du cours.
    """
    print(" 📐 Architecte : Analyse de la thématique et conception du syllabus...")

    # Récupération des directives optionnelles du professeur (Feedback Loop)
    feedback_str = f"\n DIRECTIVES SUPPLÉMENTAIRES : {state.get('teacher_feedback')}" if state.get('teacher_feedback') else ""

    prompt = f"""
Tu es un Ingénieur Pédagogique Senior spécialisé dans l'éducation technologique.
Ta mission est de concevoir un SYLLABUS structuré pour des élèves de {state['age_group']} ans.

SUJET DU COURS : "{state['input_request']}"
ÂGE CIBLE : {state['age_group']} ans
NIVEAU : {state.get('level', 'BEGINNER')}
{feedback_str}

═══════════════════════════════════════════════════
MISSION SUR LE LANGAGE TECHNIQUE :
═══════════════════════════════════════════════════
1. Analyse le "SUJET DU COURS". Si un langage est mentionné (ex: Python, Scratch, C++), utilise-le.
2. Sinon, déduis la technologie la plus adaptée au contexte (ex: Robotique -> Arduino/C++, Web -> HTML/JS, IA -> Python).
3. Si le sujet n'est pas technique, indique "Théorie".

═══════════════════════════════════════════════════
FORMAT OBLIGATOIRE (JSON STRICT) :
═══════════════════════════════════════════════════
Génère UNIQUEMENT un objet JSON valide respectant cette structure :

```json
{{
  "programmingLanguage": "Le langage détecté",
  "courseTitle": "Titre professionnel du cours",
  "level": "{state.get('level')}",
  "totalDuration": "Durée totale estimée",
  "objectives": ["Objectif 1", "Objectif 2"],
  "modules": [
    {{
      "order": 1,
      "title": "Titre du module",
      "duration": "X min",
      "description": "Description succincte du contenu"
    }}
  ]
}}
```
"""
    
    # Appel au LLM pour la génération du plan
    response = model.invoke(prompt)
    raw_content = response.content.strip()
    
    # --- Extraction sécurisée du bloc JSON du Markdown ---
    if "```json" in raw_content:
        raw_content = raw_content.split("```json")[1].split("```")[0]
    elif "```" in raw_content:
        raw_content = raw_content.split("```")[1].split("```")[0]
    
    clean_json = raw_content.strip()
    
    # --- Extraction du langage pour synchroniser les autres agents (Writer, Assessor) ---
    detected_lang = "Python" # Valeur de secours par défaut
    try:
        data = json.loads(clean_json)
        detected_lang = data.get("programmingLanguage", "Python")
    except Exception:
        print(" ⚠️ Architecte : Erreur de lecture JSON, utilisation du langage par défaut.")

    # --- Télémétrie : Envoi de la progression (30%) au Hub NestJS ---
    draft_id = state.get("draft_id")
    if draft_id:
        try:
            # On utilise l'endpoint interne pour mettre à jour la progression du brouillon
            requests.patch(
                f"http://localhost:3000/api/ai/internal/drafts/{draft_id}/progress", 
                json={"progressPercent": 30}
            )
        except Exception as e:
            print(f" ⚠️ Architecte : Erreur lors de la mise à jour de la progression : {e}")

    # On retourne le syllabus JSON et le langage détecté pour mettre à jour l'état global
    return {
        "syllabus": clean_json,
        "programming_language": detected_lang
    }