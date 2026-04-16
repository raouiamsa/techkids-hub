import os
import json
from langchain_groq import ChatGroq
from dotenv import load_dotenv

load_dotenv()

# --- Configuration des Modèles (Basée sur ta liste Groq) ---

# Agent 1 : Le Générateur (Expert en Code Qwen 3 - 60 RPM)
# On utilise Qwen 3 32B car il est extrêmement performant pour la génération de code rapide.
generator_model = ChatGroq(
    model="qwen/qwen3-32b",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.4
)

# Agent 2 : Le Critique (Llama 3.3 70B - 30 RPM)
# Choisi pour sa rigueur et sa capacité à détecter les erreurs logiques.
critic_model = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.1
)

def _extract_json(text: str) -> str:
    """ Extrait proprement le bloc JSON du texte brut renvoyé par l'IA. """
    text = text.strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]
    return text.strip()

def generate_practice_exercise(
    concept: str, 
    age_group: int, 
    level: str, 
    student_mistake: str, 
    is_success: bool,
    language: str = "Python"
) -> dict:
    """
    Architecture MoA (Mixture of Agents) Synchrone.
    Génère un exercice de renforcement ou de remédiation validé par un second agent.
    """
    
    print(f"🔄 Practice More : Préparation d'un défi {language} sur '{concept}'...")
    
    # ── ÉTAPE 1 : GÉNÉRATION DE L'EXERCICE (Qwen 3) ──
    if is_success:
        context_prompt = f"L'élève a réussi. Propose un défi de consolidation de niveau {level} légèrement plus complexe."
    else:
        context_prompt = f"L'élève a échoué. Son erreur : '{student_mistake}'. Produis un exercice simplifié pour débloquer ce concept."

    gen_prompt = f"""
Tu es Sophie Chen, tuteur expert en {language} pour les enfants de {age_group} ans.
Mission : {context_prompt}
Concept technique : {concept}

Génère un exercice interactif de programmation au format JSON.
IMPORTANT : La solution doit être parfaite.

STRUCTURE JSON REQUISE :
{{
  "title": "Titre fun",
  "language": "{language}",
  "instructions": "Consigne simple et encourageante",
  "starterCode": "Code à trous ou incomplet",
  "solution": "Code complet corrigé",
  "hints": ["Indice 1", "Indice 2"]
}}
"""
    try:
        response = generator_model.invoke(gen_prompt)
        exercise_json = json.loads(_extract_json(response.content))
        
        # ── ÉTAPE 2 : VÉRIFICATION QUALITÉ (Llama 3.3) ──
        print(f"🧐 Practice More : Audit de sécurité par Llama 3.3...")
        
        eval_prompt = f"""Tu es un Expert Quality Control en {language}.
Vérifie cet exercice pour un enfant de {age_group} ans :
- Consigne : {exercise_json.get('instructions')}
- Solution : {exercise_json.get('solution')}

L'exercice est-il techniquement correct et adapté pédagogiquement ?
Réponds UNIQUEMENT par : OUI ou NON.
"""
        critic_res = critic_model.invoke(eval_prompt)
        verdict = critic_res.content.strip().upper()
        
        if "NON" in verdict:
            print(f"⚠️ Alerte : Exercice rejeté par le critique. Tentative de secours...")
            # Ici, on pourrait ajouter une logique de retry, mais pour le PFE, on lève une erreur propre
            raise ValueError("Qualité insuffisante du contenu généré.")
            
        print(f"✅ Défi validé avec succès ({language}).")
        return exercise_json

    except Exception as e:
        print(f"❌ Erreur lors de la génération Practice More : {e}")
        # Fallback simple pour ne pas bloquer l'étudiant
        return {
            "title": "Petit défi de révision",
            "language": language,
            "instructions": f"Révisons ensemble le concept : {concept}.",
            "starterCode": "# Écris ton code ici",
            "solution": "",
            "hints": ["Relis bien la leçon précédente !"]
        }