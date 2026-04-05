import os
import fitz  # PyMuPDF
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_google_genai import ChatGoogleGenerativeAI
from google import genai as google_genai
from dotenv import load_dotenv

load_dotenv()

# ── TEST : text-embedding-005 via Gemini API (GOOGLE_API_KEY) ───────────────
print(" Archiviste: Initialisation text-embedding-005 (Gemini API)...")
_genai_client = google_genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

class GeminiEmbeddings:
    """Wrapper LangChain-compatible pour Gemini Embeddings API"""

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        print(f"   Vectorisation de {len(texts)} textes en un seul appel...")
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

_embeddings = GeminiEmbeddings()
print(" Archiviste: text-embedding-005 prêt !")

vision_model = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    google_api_key=os.getenv("GOOGLE_API_KEY")
)

def ingest_pdf(file_path: str, course_id: str):
    """Transforme un PDF en mémoire vectorielle (Version GEMINI CLOUD)"""
    if not os.path.exists(file_path):
        print(f" Erreur: Le fichier {file_path} n'existe pas.")
        return

    print(f" Archiviste: Lecture de {file_path} pour le cours {course_id}...")

    # 1. Charger le document
    loader = PyPDFLoader(file_path)
    documents = loader.load()
    print(f"   {len(documents)} pages chargées.")

    # 2. Découper intelligemment
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1200,
        chunk_overlap=200,
        separators=["\n\n", "\n", ".", "!", "?", " "]
    )
    texts = text_splitter.split_documents(documents)
    print(f"   {len(texts)} morceaux de texte créés.")

    # ── MOTS-CLÉS FIGURES ACADÉMIQUES (7 langues) ─────────────────────────────────
    # Source : nomenclature standard des documents académiques et pédagogiques.
    # Chaque langue couvre les abréviations et variantes courantes.
    FIGURE_KEYWORDS = {
        # Français
        "figure", "fig.", "fig ", "tableau", "schéma", "graphique",
        "graphe", "diagramme", "illustration", "architecture", "organigramme",
        "modèle", "représentation", "carte", "plan", "dessin",

        # English
        "figure", "fig.", "table", "chart", "diagram", "graph",
        "illustration", "flowchart", "model", "map", "plot", "drawing",
        "architecture", "schema", "overview",

        # Arabe (العربية)
        "شكل", "جدول", "مخطط", "رسم", "صورة", "نموذج",
        "خريطة", "بيان", "رسم بياني", "هيكل",

        # Espagnol (Español)
        "figura", "tabla", "diagrama", "gráfico", "esquema",
        "ilustración", "modelo", "mapa", "plano",

        # Allemand (Deutsch)
        "abbildung", "abb.", "tabelle", "diagramm", "grafik",
        "schema", "modell", "karte", "übersicht",

        # Italien (Italiano)
        "figura", "tabella", "diagramma", "grafico", "schema",
        "illustrazione", "modello", "mappa",

        # Portugais (Português)
        "figura", "tabela", "diagrama", "gráfico", "esquema",
        "ilustração", "modelo", "mapa",
    }

    # 3. ANALYSE MULTIMODALE — figures pédagogiques nommées uniquement
    import time
    doc_images = fitz.open(file_path)
    visual_contexts = []
    MAX_VISUAL_PAGES = 10
    visual_count = 0

    for page_index in range(len(doc_images)):
        if visual_count >= MAX_VISUAL_PAGES:
            break
        page = doc_images[page_index]

        # Filtre 1 : La page doit contenir des images
        if not page.get_images(full=True):
            continue

        # Filtre 2 : Le texte doit mentionner un mot-clé de figure (toutes langues)
        page_text_lower = page.get_text().lower()
        matched_keyword = next(
            (kw for kw in FIGURE_KEYWORDS if kw in page_text_lower), None
        )

        if not matched_keyword:
            print(f"   Page {page_index + 1} — image décorative ignorée (aucune nomenclature)")
            continue

        print(f"   Figure détectée page {page_index + 1} [mot-clé: '{matched_keyword}'] ({visual_count + 1}/{MAX_VISUAL_PAGES})...")
        text_context = page.get_text()[:500]
        prompt = f"Page {page_index + 1} d'un cours. Texte : '{text_context}'. Décris la figure ou le schéma présent et son rôle pédagogique."
        try:
            vis_desc = vision_model.invoke(prompt).content
            visual_contexts.append({
                "page_content": f"[FIGURE PAGE {page_index + 1}] : {vis_desc}",
                "metadata": {
                    "course_id": course_id,
                    "source": file_path,
                    "page": page_index + 1,
                    "type": "visual"
                }
            })
            visual_count += 1
            if visual_count < MAX_VISUAL_PAGES:
                time.sleep(5)  # 15 req/min = 1 toutes les 4s
        except Exception as e:
            print(f"   Vision ignorée page {page_index + 1}: {e}")

    doc_images.close()

    # 4. Préparer tous les documents avec métadonnées
    from langchain_core.documents import Document
    final_docs = []
    for t in texts:
        t.metadata["course_id"] = course_id
        final_docs.append(t)
    for v in visual_contexts:
        final_docs.append(Document(
            page_content=v["page_content"],
            metadata=v["metadata"]
        ))

    # 5. Vectorisation via Gemini (API call — ultra rapide)
    print(f" Archiviste: Vectorisation via Gemini Embeddings ({len(final_docs)} morceaux)...")
    Chroma.from_documents(
        documents=final_docs,
        embedding=_embeddings,   # ← Gemini API, 0 calcul local
        persist_directory="./data/chroma_db"
    )

    print(f" Terminé ! {len(final_docs)} morceaux indexés pour '{course_id}'.")

if __name__ == "__main__":
    pass
