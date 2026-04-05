import os
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
from .state import AgentState

load_dotenv()

model = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=os.getenv("GOOGLE_API_KEY"))

def architect_node(state: AgentState):
    print(" Architecte: Je conçois le plan pédagogique...")

    feedback_str = f"\n RÉVISION DEMANDÉE PAR LE PROFESSEUR : {state.get('teacher_feedback')}" if state.get('teacher_feedback') else ""

    prompt = f"""
Tu es Pr. Karim, Ingénieur Pédagogique Senior avec 15 ans d'expérience en conception de curricula pour les jeunes de {state['age_group']} ans.
Ta mission : concevoir un SYLLABUS OFFICIEL DE COURS complet, rigoureux et directement exploitable par un enseignant.

SUJET DU COURS : "{state['input_request']}"
GROUPE D'ÂGE : {state['age_group']} ans
{feedback_str}

═══════════════════════════════════════════════════
RÈGLES ABSOLUES — À RESPECTER IMPÉRATIVEMENT :
═══════════════════════════════════════════════════
1. AUCUNE introduction conversationnelle ("Bien sûr !", "Avec plaisir !", "Voici !", etc.)
2. AUCUN style blog ou chatbot — tu rédiges un document de travail professionnel
3. Commence DIRECTEMENT par le titre du cours sans préambule
4. Chaque module doit avoir : durée, objectifs mesurables, contenu, activité, évaluation
5. Utilise des verbes d'action pédagogique (Bloom) : Identifier, Analyser, Concevoir, Appliquer, Évaluer...
6. Le cours doit couvrir AU MINIMUM 3 modules avec progression logique (simple → complexe)

═══════════════════════════════════════════════════
FORMAT OBLIGATOIRE (respecter scrupuleusement) :
═══════════════════════════════════════════════════

# 🎓 [TITRE COMPLET DU COURS]

| Métadonnée | Valeur |
|---|---|
| **Niveau** | [Débutant / Intermédiaire / Avancé] |
| **Groupe d'âge** | {state['age_group']} ans |
| **Durée totale** | [X heures] |
| **Prérequis** | [Liste précise ou "Aucun"] |
| **Format** | [Présentiel / En ligne / Mixte] |

## 🎯 Objectifs Généraux du Cours
À l'issue de ce cours, l'apprenant sera capable de :
1. [Objectif mesurable 1 — verbe Bloom + résultat attendu]
2. [Objectif mesurable 2]
3. [Objectif mesurable 3]

---

## 📚 MODULE 1 : [TITRE]
**⏱ Durée :** [X min]
**🎯 Objectif du module :** [Objectif spécifique]

### Contenu théorique
- **[Concept A]** : [Explication précise]
- **[Concept B]** : [Explication précise]

### 🔬 Activité pratique
> [Description détaillée de l'exercice, avec étapes numérotées]

### ✅ Critères d'évaluation
- [ ] [Critère 1]
- [ ] [Critère 2]

---

## 📚 MODULE 2 : [TITRE]
[Même structure que Module 1]

---

## 📚 MODULE 3 : [TITRE]
[Même structure que Module 1]

---

## 📝 ÉVALUATION FINALE
**Type :** [Projet / QCM / Oral / Production]
**Description :** [Énoncé complet]
**Critères de réussite :** [Grille d'évaluation]

## 📦 RESSOURCES ET MATÉRIEL
- **Outils :** [Liste]
- **Documents :** [Références]
- **Bibliographie :** [Sources]
"""
    response = model.invoke(prompt)
    return {"syllabus": response.content}
