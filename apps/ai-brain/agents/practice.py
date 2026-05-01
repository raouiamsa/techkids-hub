import os
import json
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from dotenv import load_dotenv
from core.prompts_library import (
    get_practice_explanation_prompt,
    get_practice_exercise_prompt,
    get_practice_critic_prompt
)

load_dotenv()

# 1. Configuration des Modeles (Plan A: NVIDIA -> Plan B:Groq)
def _init_model(cls, **kwargs):
    """
    Initialise un modele uniquement si la cle API est presente dans l'environnement.
    """
    try:
        key = kwargs.get("openai_api_key") or kwargs.get("api_key")
        if key: 
            return cls(**kwargs)
    except Exception as e:
        print(f"[Avertissement] Echec de l'initialisation pour {cls}: {e}")
    return None

# --- Agent 1 : Generateur (Temperature 0.4 pour la creativite pedagogique) ---
_groq_generator = _init_model(ChatGroq,
    model="llama-3.3-70b-versatile",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.4
)

def _generator_invoke(prompt: str):
    if not _groq_generator:
        raise RuntimeError("Generateur Groq non configure.")
    print("[Practice Generateur] Tentative avec Llama 3.3 70B (Groq)...")
    res = _groq_generator.invoke(prompt)
    if res.content: 
        return res
    raise Exception("Generateur Groq a echoue.")

# --- Agent 2 : Critique (Temperature 0.1 pour un controle strict) ---
_groq_critic = _init_model(ChatGroq,
    model="llama-3.3-70b-versatile",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.1
)

def _critic_invoke(prompt: str):
    if not _groq_critic:
        raise RuntimeError("Critique Groq non configure.")
    print("[Practice Critique] Tentative avec Llama 3.3 70B (Groq)...")
    res = _groq_critic.invoke(prompt)
    if res.content: 
        return res
    raise Exception("Critique Groq a echoue.")

# 2. Utilitaires JSON
def _extract_json(text: str) -> str:
    """Extrait proprement le bloc JSON du texte brut renvoye par l'IA."""
    text = text.strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]
    return text.strip()

# 3. Logique de Generation et Remediation

def _generate_explanation(concept: str, age_group: int, student_mistake: str, language: str) -> dict:
    """
    Etape 1 (Remediation uniquement) : Genere une explication pedagogique
    avec une analogie simple pour debloquer l'enfant.
    Appelee UNIQUEMENT en cas d'echec (is_success = False).
    """
    print(f"[Practice] Generation de l'explication pedagogique pour '{concept}'...")

    prompt = get_practice_explanation_prompt(
        language=language,
        age_group=age_group,
        student_mistake=student_mistake,
        concept=concept
    )
    try:
        response = _generator_invoke(prompt)
        return json.loads(_extract_json(response.content))
    except Exception as e:
        print(f"[Avertissement] Fallback explication : {e}")
        return {
            "analogy": f"Imagine que '{concept}' est comme une regle du jeu qu'il faut apprendre une fois pour toujours !",
            "key_points": ["Relis bien la definition.", "Essaie de trouver un exemple dans la vraie vie."],
            "encouragement": "Tu vas y arriver, ne lache pas !"
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
    Etape 2 : Genere l'exercice adapte.
    - Succes -> Defi de consolidation plus complexe
    - Echec  -> Exercice simplifie pour valider la comprehension
    """
    if is_success:
        context_prompt = (
            f"L'eleve a REUSSI. Genere un defi de niveau {level} legerement plus complexe "
            f"ou une variante creative du concept '{concept}' pour ancrer les connaissances."
        )
        difficulty_note = f"PLUS DIFFICILE que l'exercice precedent, mais reste adapte a {age_group} ans."
    else:
        context_prompt = (
            f"L'eleve a ECHOUE. Son erreur : '{student_mistake}'. "
            f"Genere un exercice SIMPLIFIE pour valider qu'il a bien compris apres l'explication."
        )
        difficulty_note = "PLUS SIMPLE que l'exercice precedent. Etapes claires, guidees."

    prompt = get_practice_exercise_prompt(
        language=language,
        age_group=age_group,
        context_prompt=context_prompt,
        concept=concept,
        difficulty_note=difficulty_note
    )
    try:
        response = _generator_invoke(prompt)
        return json.loads(_extract_json(response.content))
    except Exception as e:
        print(f"[Avertissement] Fallback exercice : {e}")
        return {
            "title": "Petit defi de revision",
            "language": language,
            "instructions": f"Revisons ensemble le concept : {concept}.",
            "starterCode": "# Ecris ton code ici\n",
            "solution": "",
            "hints": ["Relis bien la lecon precedente !"]
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
    Point d'entree principal - Architecture MoA (Mixture of Agents).

    Genere un Mini-Module de Practice More en 2 ou 3 etapes selon le contexte :

    Cas SUCCES :
        Etape 1 : Generation d'un exercice de renforcement (plus complexe)
        Etape 2 : Validation qualite par le Critique (Llama 3.3)

    Cas ECHEC :
        Etape 1 : Generation de l'explication pedagogique (analogie + points cles)
        Etape 2 : Generation d'un exercice de remediation (simplifie)
        Etape 3 : Validation qualite par le Critique (Llama 3.3)
    """
    mode = "reinforcement" if is_success else "remediation"
    print(f"\n[Practice] Mode : {'RENFORCEMENT' if is_success else 'REMEDIATION'}")
    print(f"[Practice] Concept : {concept} | Age : {age_group} ans | Langue : {language}")

    # --- Etape 1 : Explication (remediation uniquement) ---
    explanation = None
    if not is_success:
        explanation = _generate_explanation(concept, age_group, student_mistake, language)

    # --- Etape 2 : Generation de l'exercice ---
    exercise = _generate_exercise(concept, age_group, level, student_mistake, is_success, language)

    # --- Etape 3 : Validation qualite par le Critique ---
    eval_prompt = get_practice_critic_prompt(
        language=language,
        age_group=age_group,
        instructions=exercise.get('instructions'),
        solution=exercise.get('solution')
    )
    try:
        critic_res = _critic_invoke(eval_prompt)
        verdict = critic_res.content.strip().upper()
        if "NON" in verdict:
            print("[Avertissement] Exercice rejete par le critique. Utilisation du fallback de securite.")
            exercise["hints"].append("Demande a ton professeur si tu bloques encore !")
    except Exception as e:
        print(f"[Avertissement] Critique indisponible : {e}")

    print(f"[Succes] Mini-Module Practice More pret ({mode}).")
    return {
        "mode": mode,
        "moduleTitle": f"{'Defi' if is_success else 'Aide'} : {concept}",
        "explanation": explanation,   # None si succes, objet si echec
        "exercise": exercise
    }