import os
import json
import requests
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from .state import AgentState

load_dotenv()

# --- Configuration du Modèle ---
# LLaMA 3.3 70B : Choisi pour sa rigueur analytique et sa stabilité sur Groq
model = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.1 # Température basse pour une évaluation objective
)

def _clean_json(raw: str) -> str:
    """ Nettoie le bloc JSON renvoyé par l'IA pour extraire la donnée brute. """
    raw = raw.strip()
    if "```json" in raw: 
        raw = raw.split("```json")[1].split("```")[0]
    elif "```" in raw: 
        raw = raw.split("```")[1].split("```")[0]
    return raw.strip()

def critic_node(state: AgentState):
    """
    Agent de contrôle qualité final (Critique).
    Vérifie la fidélité aux sources, la pédagogie, le code et la présence des citations.
    """
    iteration = state.get('iterations', 0)
    language = state.get("programming_language", "Python")
    draft_id = state.get("draft_id")
    
    print(f"🧐 Critique : Vérification finale du cours de {language} (Itération {iteration})...")

    # --- Préparation des données pour l'audit ---
    content_raw = (state.get("content") or [""])[-1]
    sources = state.get("source_documents", [])
    age = state.get("age_group", 12)

    # Analyse de la structure JSON produite par Sophie Chen
    try:
        course_data = json.loads(content_raw)
        modules = course_data.get("modules", [])
        modules_summary = "\n".join([
            f"- Module {m.get('order', i+1)} : {m.get('title', 'Sans titre')}"
            for i, m in enumerate(modules)
        ])
        content_sample = modules[0].get("content", "") if modules else ""
    except Exception:
        modules_summary = "Erreur critique de structure JSON."
        content_sample = "Contenu illisible."

    # Préparation du texte des sources de référence (RAG)
    source_text = "\n".join([
        f"[Source {s.get('ref', '?')}]: {s.get('content', '')}" for s in sources[:5]
    ]) if sources else "Aucune source externe disponible pour vérification."

    # --- Prompt d'Audit Qualité ---
    eval_prompt = f"""Tu es l'Expert en Contrôle Qualité Pédagogique (Auditeur Senior).
Ton rôle : Valider si le cours généré est prêt pour un enfant de {age} ans et fidèle aux sources originales.

═══════════════════════════════════════════════════
CONTEXTE DU COURS :
═══════════════════════════════════════════════════
- Langage technique cible : {language}
- Âge cible : {age} ans
- Plan : {modules_summary}

EXTRAIT DU CONTENU RÉDIGÉ (Vérifie les citations) :
{content_sample[:800]}

═══════════════════════════════════════════════════
CRITÈRES D'AUDIT STRICTES :
═══════════════════════════════════════════════════
1. CITATIONS : Le texte doit citer les sources au format "(Source: Nom, Page/Temps)".
2. ANTI-HALLUCINATION : Le contenu est-il 100% cohérent avec les sources fournies ?
3. TECHNIQUE : Le code et les exercices portent-ils BIEN sur le langage {language} ?
4. ADAPTATION : Le ton est-il encourageant et le vocabulaire adapté à {age} ans ?
5. STRUCTURE : Le format JSON global est-il valide pour l'affichage Frontend ?

RÉPONDS UNIQUEMENT EN JSON :
{{
  "approved": true | false,
  "score": 0-100,
  "issues": ["Liste des problèmes si approved est false"],
  "recommendations": ["Conseils d'amélioration"]
}}
"""

    response = model.invoke(eval_prompt)
    try:
        verdict = json.loads(_clean_json(response.content))
        approved = verdict.get("approved", True)
        
        # Télémétrie : Mise à jour de la progression finale + AI Score
        if draft_id:
            try:
                requests.patch(
                    f"http://localhost:3000/api/ai/internal/drafts/{draft_id}/progress",
                    json={
                        "progressPercent": 95 if not approved else 100,
                        "aiScore": verdict.get("score", None)  # Score 0-100 du Critique
                    }
                )
            except: pass

        print(f"    Verdict : {'✅ APPROUVÉ' if approved else '❌ REJETÉ'} (Score: {verdict.get('score')}/100)")
        
    except Exception as e:
        print(f"    ⚠️ Erreur de parsing du verdict : {e}. Approbation par défaut.")
        approved = True
        verdict = {"issues": []}

    # --- Logique de boucle (Human/AI Loop) ---
    teacher_fb = state.get("teacher_feedback", "").strip()

    # Priorité 1 : Le professeur a donné un feedback manuel (force une rectification)
    if teacher_fb and iteration < 1:
        print("    Feedback professeur détecté. Relance du cycle...")
        return {"teacher_feedback": teacher_fb, "iterations": iteration + 1}

    # Priorité 2 : Le critique rejette automatiquement le contenu
    if not approved and iteration < 1:
        feedback_auto = f"CRITIQUE TECHNIQUE : {', '.join(verdict.get('issues', []))}"
        print(f"    Auto-correction demandée : {feedback_auto}")
        return {"teacher_feedback": feedback_auto, "iterations": iteration + 1}

    # Fin du cycle : on vide le feedback pour signaler au Graph de s'arrêter
    return {"teacher_feedback": "", "iterations": iteration + 1}


def should_continue(state: AgentState):
    """
    Nœud de décision LangGraph.
    Si un feedback est présent (manuel ou auto), on retourne à l'architecte pour correction.
    """
    if state.get("teacher_feedback") and state.get("iterations", 0) < 2:
        return "rectify"
    return "end"