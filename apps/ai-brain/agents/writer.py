import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_chroma import Chroma
from google import genai as google_genai
from dotenv import load_dotenv
from .state import AgentState

load_dotenv()

model = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=os.getenv("GOOGLE_API_KEY"))

_genai_client = google_genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

class GeminiEmbeddings:
    """Wrapper LangChain-compatible pour Gemini Embeddings API"""
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        result = _genai_client.models.embed_content(
            model="text-embedding-005",
            contents=texts,
        )
        return [e.values for e in result.embeddings]

    def embed_query(self, text: str) -> list[float]:
        result = _genai_client.models.embed_content(
            model="text-embedding-005",
            contents=[text],
        )
        return result.embeddings[0].values

# DOIT être identique à ingest.py — sinon ChromaDB ne trouve rien
vectorstore = Chroma(persist_directory="./data/chroma_db", embedding_function=GeminiEmbeddings())

def writer_node(state: AgentState):
    print(f" Rédacteur: Rédaction EXPERTE (BGE-M3 + Traçabilité) pour {state['course_id']}...")

    # On cherche plus de documents (k=10) pour une meilleure couverture
    query = f"Contenu éducatif précis pour : {state['syllabus'][:400]}"
    docs = vectorstore.similarity_search(
        query,
        k=10,
        filter={"course_id": state['course_id']}
    )

    source_docs_info = []
    if not docs:
        print(" Attention: Aucun document trouvé pour cet ID.")
        context = "Aucune source externe — génère depuis tes connaissances pédagogiques."
    else:
        # On extrait le contenu ET on garde une trace des sources pour le Critique
        context_parts = []
        for d in docs:
            page = d.metadata.get('page', '?')
            source_docs_info.append({"page": page, "content": d.page_content[:200]})
            context_parts.append(f"[Source Page {page}]: {d.page_content}")
        
        context = "\n\n".join(context_parts)

    feedback_str = f"\n RÉVISION DEMANDÉE : {state.get('teacher_feedback')}" if state.get('teacher_feedback') else ""

    prompt = f"""
Tu es l'Expert-Rédacteur, spécialisée en ingénierie pédagogique pour la Tech et la Science ({state['age_group']} ans).
Ton objectif est de transformer les sources brutes en un cours structuré, captivant et IRRÉPROCHABLE.

 SOURCES DOCUMENTAIRES (VÉRIFIÉES) :
{context}
SYLLABUS À SUIVRE :
{state['syllabus']}
{feedback_str}

RÈGLES D'OR :
 Interdit : "Bonjour !", "Bien sûr !", "Allons-y !", style chatbot.
 Citations : Cite les sources (ex: "D'après la page X du document...").
 Densité : Dense, riche, précis. Chaque concept pleinement expliqué.
 Exemples : Adaptés aux jeunes de {state['age_group']} ans (robots, drones, espace, jeux).
 Exercices : Énoncés complets — AUCUN placeholder.


STRUCTURE OBLIGATOIRE DU COURS :

#  [TITRE COMPLET DE LA LEÇON]
> **Durée estimée :** [X min] | **Niveau :** [niveau] | **Prérequis :** [...]
## Objectifs d'apprentissage
À l'issue de cette leçon, l'apprenant sera capable de :
- [Verbe de Bloom 1 — précis et mesurable]
- [Verbe de Bloom 2]
- [Verbe de Bloom 3]

## 1. [TITRE SECTION THÉORIQUE 1]
[3 à 5 paragraphes : définitions, mécanismes, analogies]

###  Point clé
> [Formule essentielle à retenir]

###  Exemple concret
**Situation :** [...] **Application :** [...] **Résultat :** [...]

## 2. [TITRE SECTION THÉORIQUE 2]
[Contenu détaillé]

###  Point clé
> [...]

## 3. [CONNEXION THÉORIE-PRATIQUE]
[Problèmes réels, cas d'usage, applications industrielles]

##  Exercices de Compréhension
**Exercice 1 — [Type]** : [Énoncé complet]
>  *Indice :* [...]

**Exercice 2 — [Type]** : [Énoncé complet]
>  *Indice :* [...]

**Exercice 3 — [Niveau avancé]** : [Énoncé complet]

##  Activité Pratique
**Titre :** [...] | **Durée :** [X min] | **Matériel :** [...]
**Étapes :**
1. [Instruction précise]
2. [Instruction précise]
3. [...]
**Livrable attendu :** [Ce que l'élève doit produire]

##  Résumé de la Leçon
| Concept | Définition essentielle |
|---|---|
| [Terme 1] | [Définition courte] |
| [Terme 2] | [Définition courte] |

**À retenir :** [3 points clés]

##  Questions de Révision
1. [Question conceptuelle]
2. [Question d'application]
3. [Question d'analyse]

##  Pour aller plus loin
- [Ressource 1]
- [Ressource 2]

Génère maintenant le cours COMPLET en Markdown. Ne laisse aucune section vide.
"""

    response = model.invoke(prompt)
    
    # On met à jour l'état avec le contenu ET les sources pour le Critique
    return {
        "content": [response.content],
        "source_documents": source_docs_info
    }
