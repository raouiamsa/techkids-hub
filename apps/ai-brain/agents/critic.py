import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from .state import AgentState

load_dotenv()
model = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=os.getenv("GOOGLE_API_KEY"))

def critic_node(state: AgentState):
    """
    Agent Critique EXPERT :
    1. VÉRIFICATION FIDÉLITÉ : Compare le contenu aux sources (Détection hallucinations)
    2. HITL : Analyse les retours du prof
    """
    iteration = state.get('iterations', 0)
    print(f" Critique: Vérification Expertise + Fidélité (Itération {iteration})...")
    
    content = (state.get("content") or [""])[-1]
    sources = state.get("source_documents", [])
    age = state.get("age_group", 12)

    # ──────────────────────────────────────────────────────
    # ÉTAPE 1 : VÉRIFICATION DE FIDÉLITÉ (Anti-hallucination)
    # ──────────────────────────────────────────────────────
    source_text = "\n".join([f"Page {s['page']}: {s['content']}" for s in sources])
    
    eval_prompt = f"""
Tu es un Expert en Contrôle Qualité Pédagogique. 
Ton rôle est de vérifier si le cours généré est FIDÈLE aux sources et adapté à l'âge ({age} ans).

EXTRAITS DES SOURCES :
{source_text}

CONTENU GÉNÉRÉ (EXTRAIT) :
{content[:1000]}

TON ANALYSE :
1. Est-ce que le rédacteur a inventé des informations non présentes dans les sources ?
2. Le ton est-il adapté à un enfant de {age} ans ?
3. Manque-t-il un concept clé mentionné dans les sources ?

Réponds UNIQUEMENT sous ce format :
VERDICT: [OUI/NON]
RAISON: [Si NON, explique brièvement pourquoi]
"""
    
    response = model.invoke(eval_prompt).content.strip()
    print(f"   Verdict Critique : {response.splitlines()[0]}")

    auto_feedback = ""
    if "VERDICT: NON" in response.upper():
        auto_feedback = response.split("RAISON:")[1].strip() if "RAISON:" in response else "Incohérence détectée."

    # ──────────────────────────────────────────────────────
    # ÉTAPE 2 : PRIORITÉ AU FEEDBACK PROFESSEUR
    # ──────────────────────────────────────────────────────
    teacher_fb = state.get("teacher_feedback", "").strip()
    final_feedback = teacher_fb if teacher_fb else auto_feedback

    if not final_feedback:
        print(" Cours validé avec succès ✅")
        return {"teacher_feedback": ""}

    return {
        "teacher_feedback": final_feedback,
        "iterations": iteration + 1
    }

def should_continue(state: AgentState):
    if state.get("teacher_feedback") and state.get("iterations", 0) < 3:
        return "rectify"
    return "end"
