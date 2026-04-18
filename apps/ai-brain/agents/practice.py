import os
import json
from langchain_groq import ChatGroq
from dotenv import load_dotenv

load_dotenv()

# --- Configuration des Modèles ---

# Agent 1 : Générateur (Qwen 3 - Expert Code + Pédagogie)
generator_model = ChatGroq(
    model="qwen/qwen3-32b",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.4
)

# Agent 2 : Critique (Llama 3.3 70B - Vérification qualité)
critic_model = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.1
)

def _extract_json(text: str) -> str:
    """Extrait proprement le bloc JSON du texte brut renvoyé par l'IA."""
    text = text.strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]
    return text.strip()


def _generate_explanation(concept: str, age_group: int, student_mistake: str, language: str) -> dict:
    """
    Étape 1 (Remédiation uniquement) : Génère une explication pédagogique
    avec une analogie simple pour débloquer l'enfant.
    Appelée UNIQUEMENT en cas d'échec (is_success = False).
    """
    print(f"📖 Practice More : Génération de l'explication pédagogique pour '{concept}'...")

    prompt = f"""
Tu es Sophie Chen, une pédagogue experte en {language} pour les enfants de {age_group} ans.
Un enfant a échoué et a commis cette erreur : "{student_mistake}".
Le concept qu'il n'a pas compris : "{concept}".

Tu dois réexpliquer ce concept de façon DIFFÉRENTE du cours initial.
Utilise une analogie du quotidien (ex: une variable = un tiroir, une boucle = une recette de cuisine...).

Génère une explication au format JSON :
{{
  "analogy": "Une phrase courte et amusante comparant le concept à quelque chose de familier pour un enfant",
  "key_points": [
    "Point essentiel 1 (max 1 phrase simple)",
    "Point essentiel 2 (max 1 phrase simple)"
  ],
  "encouragement": "Un message court et motivant pour l'enfant (ex: 'Tu y es presque, essaie encore !')"
}}

IMPORTANT : L'analogie doit être TRÈS simple, adaptée à {age_group} ans. Pas de termes techniques.
"""
    try:
        response = generator_model.invoke(prompt)
        return json.loads(_extract_json(response.content))
    except Exception as e:
        print(f"⚠️ Fallback explication : {e}")
        return {
            "analogy": f"Imagine que '{concept}' est comme une règle du jeu qu'il faut apprendre une fois pour toujours !",
            "key_points": ["Relis bien la définition.", "Essaie de trouver un exemple dans la vraie vie."],
            "encouragement": "Tu vas y arriver, ne lâche pas !"
        }


def _generate_exercise(
    concept: str,
    age_group: int,
    level: str,
    student_mistake: str,
    is_success: bool,
    language: str
) -> dict:
    """
    Étape 2 : Génère l'exercice adapté.
    - Succès → Défi de consolidation plus complexe
    - Échec  → Exercice simplifié pour valider la compréhension
    """
    if is_success:
        context_prompt = (
            f"L'élève a RÉUSSI. Génère un défi de niveau {level} légèrement plus complexe "
            f"ou une variante créative du concept '{concept}' pour ancrer les connaissances."
        )
        difficulty_note = "PLUS DIFFICILE que l'exercice précédent, mais reste adapté à {age_group} ans."
    else:
        context_prompt = (
            f"L'élève a ÉCHOUÉ. Son erreur : '{student_mistake}'. "
            f"Génère un exercice SIMPLIFIÉ pour valider qu'il a bien compris après l'explication."
        )
        difficulty_note = "PLUS SIMPLE que l'exercice précédent. Étapes claires, guidées."

    prompt = f"""
Tu es Sophie Chen, tuteur expert en {language} pour les enfants de {age_group} ans.
Mission : {context_prompt}
Concept technique : {concept}
Niveau de difficulté : {difficulty_note}

Génère un exercice interactif de programmation au format JSON.
La solution doit être correcte et vérifiée.

STRUCTURE JSON REQUISE :
{{
  "title": "Titre fun et motivant",
  "language": "{language}",
  "instructions": "Consigne claire, bienveillante, max 3 phrases",
  "starterCode": "Code incomplet ou à trous que l'enfant doit compléter",
  "solution": "Code complet et fonctionnel",
  "hints": ["Indice 1", "Indice 2"]
}}
"""
    try:
        response = generator_model.invoke(prompt)
        return json.loads(_extract_json(response.content))
    except Exception as e:
        print(f"⚠️ Fallback exercice : {e}")
        return {
            "title": "Petit défi de révision",
            "language": language,
            "instructions": f"Révisons ensemble le concept : {concept}.",
            "starterCode": "# Écris ton code ici\n",
            "solution": "",
            "hints": ["Relis bien la leçon précédente !"]
        }


def generate_practice_module(
    concept: str,
    age_group: int,
    level: str,
    student_mistake: str,
    is_success: bool,
    language: str = "Python"
) -> dict:
    """
    Point d'entrée principal — Architecture MoA (Mixture of Agents).

    Génère un Mini-Module de Practice More en 2 ou 3 étapes selon le contexte :

    ✅ Cas SUCCÈS :
        Étape 1 : Génération d'un exercice de renforcement (plus complexe)
        Étape 2 : Validation qualité par Llama 3.3

    ❌ Cas ÉCHEC :
        Étape 1 : Génération de l'explication pédagogique (analogie + points clés)
        Étape 2 : Génération d'un exercice de remédiation (simplifié)
        Étape 3 : Validation qualité par Llama 3.3

    Returns:
        dict : {
            "mode": "remediation" | "reinforcement",
            "explanation": { analogy, key_points, encouragement } | None,
            "exercise": { title, language, instructions, starterCode, solution, hints }
        }
    """
    mode = "reinforcement" if is_success else "remediation"
    print(f"\n🎯 Practice More — Mode : {'🚀 RENFORCEMENT' if is_success else '🔧 REMÉDIATION'}")
    print(f"   Concept : {concept} | Âge : {age_group} ans | Langue : {language}")

    # ── ÉTAPE 1 : Explication (remédiation uniquement) ────────────────────────
    explanation = None
    if not is_success:
        explanation = _generate_explanation(concept, age_group, student_mistake, language)

    # ── ÉTAPE 2 : Génération de l'exercice ───────────────────────────────────
    exercise = _generate_exercise(concept, age_group, level, student_mistake, is_success, language)

    # ── ÉTAPE 3 : Validation qualité par Llama 3.3 ───────────────────────────
    print(f"🧐 Practice More : Audit qualité par Llama 3.3...")
    eval_prompt = f"""Tu es un Expert Quality Control en {language} pour enfants de {age_group} ans.
Vérifie cet exercice :
- Consigne : {exercise.get('instructions')}
- Solution : {exercise.get('solution')}

Est-il techniquement correct et pédagogiquement adapté ?
Réponds UNIQUEMENT par : OUI ou NON.
"""
    try:
        critic_res = critic_model.invoke(eval_prompt)
        verdict = critic_res.content.strip().upper()
        if "NON" in verdict:
            print("⚠️ Exercice rejeté par le critique. Utilisation du fallback.")
            exercise["hints"].append("Demande à ton professeur si tu bloques encore !")
    except Exception as e:
        print(f"⚠️ Critique indisponible : {e}")

    print(f"✅ Mini-Module Practice More prêt ({mode}).")
    return {
        "mode": mode,
        "moduleTitle": f"{'Défi' if is_success else 'Aide'} : {concept}",
        "explanation": explanation,   # None si succès, objet si échec
        "exercise": exercise
    }