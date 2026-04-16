import os
import re
import fitz  # PyMuPDF
import json
import requests
from bs4 import BeautifulSoup
from PIL import Image
import io
from langchain_community.document_loaders import PyPDFLoader, YoutubeLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from dotenv import load_dotenv

load_dotenv()

# ── ÉTAPE 1 : EMBEDDINGS LOCAUX (multilingual-e5-small) ──────────────────────
print("📦 Archiviste : Chargement du modèle de vecteurs (multilingual-e5-small)...")
_embeddings = HuggingFaceEmbeddings(
    model_name="intfloat/multilingual-e5-small",
    model_kwargs={"device": "cpu"},
    encode_kwargs={"normalize_embeddings": True}
)
print("✅ Modèle d'embeddings prêt !")

# ── ÉTAPE 2 : VISION LOCALE (Florence-2-base) ────────────────────────────────
_florence_model = None
_florence_processor = None

def _load_florence():
    """Charge Florence-2 en mémoire avec le patch de sécurité pour Windows."""
    global _florence_model, _florence_processor
    if _florence_model is not None:
        return
    print("🧠 Archiviste : Chargement de l'IA de vision Florence-2 (environ 700 Mo)...")
    
    import torch
    import transformers.dynamic_module_utils
    
    # ── MONKEY-PATCH : Ignorer flash_attn (Indispensable pour éviter les erreurs sur Windows)
    _original_get_imports = transformers.dynamic_module_utils.get_imports
    def custom_get_imports(filename):
        imports = _original_get_imports(filename)
        return [i for i in imports if i != "flash_attn"]
    transformers.dynamic_module_utils.get_imports = custom_get_imports
    
    from transformers import AutoProcessor, AutoModelForCausalLM
    _florence_processor = AutoProcessor.from_pretrained("microsoft/Florence-2-base", trust_remote_code=True)
    _florence_model = AutoModelForCausalLM.from_pretrained(
        "microsoft/Florence-2-base",
        torch_dtype=torch.float32, # CPU Optimisation
        trust_remote_code=True
    )
    _florence_model.eval()
    print("✅ Florence-2 est prêt pour l'analyse visuelle !")

def _florence_ocr(image_pil):
    """Extrait le texte visible dans une image (OCR)."""
    import torch
    _load_florence()
    task = "<OCR>"
    inputs = _florence_processor(text=task, images=image_pil, return_tensors="pt")
    with torch.no_grad():
        generated_ids = _florence_model.generate(
            input_ids=inputs["input_ids"],
            pixel_values=inputs["pixel_values"],
            max_new_tokens=512,
            num_beams=3
        )
    result = _florence_processor.batch_decode(generated_ids, skip_special_tokens=False)[0]
    result = _florence_processor.post_process_generation(result, task=task, image_size=(image_pil.width, image_pil.height))
    return result.get(task, "")

def _florence_describe(image_pil):
    """Génère une description détaillée d'une figure pédagogique."""
    import torch
    _load_florence()
    task = "<DETAILED_CAPTION>"
    inputs = _florence_processor(text=task, images=image_pil, return_tensors="pt")
    with torch.no_grad():
        generated_ids = _florence_model.generate(
            input_ids=inputs["input_ids"],
            pixel_values=inputs["pixel_values"],
            max_new_tokens=512,
            num_beams=3
        )
    result = _florence_processor.batch_decode(generated_ids, skip_special_tokens=False)[0]
    result = _florence_processor.post_process_generation(result, task=task, image_size=(image_pil.width, image_pil.height))
    return result.get(task, "")

# ── MOTS-CLÉS FIGURES ACADÉMIQUES ─────────────────────
FIGURE_KEYWORDS = {
    "figure", "fig.", "tableau", "schéma", "graphique", "graphe", "diagramme", "illustration",
    "table", "chart", "diagram", "graph", "flowchart", "model", "map", "plot", "drawing",
    "شكل", "جدول", "مخطط", "رسم", "صورة", "نموذج", "خريطة", "بيان", "هيكل",
    "figura", "tabla", "esquema", "abbildung", "tabelle"
}

# ── ÉTAPE 3 : FONCTIONS D'INGESTION ─────────────────────────────────────────

def ingest_pdf(file_path: str, course_id: str):
    """Pipeline PDF complet : Texte numérique + OCR + Description VLM."""
    if not os.path.exists(file_path):
        print(f"❌ Erreur : Le fichier {file_path} n'existe pas.")
        return

    print(f"\n📑 Archiviste : Lecture approfondie de {file_path} pour le cours {course_id}...")

    loader = PyPDFLoader(file_path)
    documents = loader.load()
    
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1200, 
        chunk_overlap=200,
        separators=["\n\n", "\n", ".", "!", "?", " "]
    )
    texts = text_splitter.split_documents(documents)

    doc_images = fitz.open(file_path)
    ocr_enrichments = {}
    visual_contexts = []
    
    for page_idx in range(len(doc_images)):
        page = doc_images[page_idx]
        images = page.get_images(full=True)
        if not images:
            continue

        page_text_lower = page.get_text().lower()
        matched_keyword = next((kw for kw in FIGURE_KEYWORDS if kw in page_text_lower), None)

        try:
            xref = images[0][0]
            base_image = doc_images.extract_image(xref)
            image_pil = Image.open(io.BytesIO(base_image["image"])).convert("RGB")
            
            ocr_text = _florence_ocr(image_pil)
            if ocr_text and len(ocr_text.strip()) > 20:
                ocr_enrichments[page_idx] = ocr_text
            
            if matched_keyword:
                description = _florence_describe(image_pil)
                if description:
                    visual_contexts.append(Document(
                        page_content=f"[DESCRIPTION FIGURE PAGE {page_idx+1}] : {description}",
                        metadata={"course_id": course_id, "source": file_path, "page": page_idx+1, "type": "visual"}
                    ))
        except Exception:
            continue

    doc_images.close()

    final_docs = []
    for t in texts:
        t.metadata["course_id"] = course_id
        page_num = t.metadata.get("page", -1)
        if page_num - 1 in ocr_enrichments:
            t.page_content += f"\n\n[TEXTE IMAGE PAGE {page_num}] : {ocr_enrichments[page_num - 1]}"
        final_docs.append(t)
    
    final_docs.extend(visual_contexts)

    Chroma.from_documents(documents=final_docs, embedding=_embeddings, persist_directory="./data/chroma_db")
    print(f"✅ Ingestion PDF terminée avec succès pour le cours '{course_id}'.")


def ingest_youtube(url: str, course_id: str):
    """Méthode robuste déléguant l'extraction à LangChain pour éviter les erreurs d'API locales."""
    print(f"🎥 Archiviste : Extraction des données YouTube : {url}")

    try:
        # Essai 1 : Récupérer le transcript par défaut (sans forcer la langue)
        loader = YoutubeLoader.from_youtube_url(url, add_video_info=False)
        documents = loader.load()
        
        if not documents:
            # Essai 2 : Si le défaut échoue, on cherche parmi une large liste de langues (incluant le Hindi 'hi')
            loader = YoutubeLoader.from_youtube_url(
                url, 
                add_video_info=False,
                language=["fr", "en", "ar", "hi", "es", "de", "it", "pt", "ru", "zh-Hans", "ja", "ko"]
            )
            documents = loader.load()
            
        if not documents:
            raise ValueError("Aucune piste de sous-titre disponible sur cette vidéo.")

        # 3. Préparation et Sauvegarde dans ChromaDB
        for doc in documents:
            doc.metadata["course_id"] = course_id
            doc.metadata["source"] = url
            doc.metadata["type"] = "youtube"
            doc.metadata["page"] = 1
        
        splitter = RecursiveCharacterTextSplitter(chunk_size=1200, chunk_overlap=200)
        docs = splitter.split_documents(documents)
        Chroma.from_documents(documents=docs, embedding=_embeddings, persist_directory="./data/chroma_db")
        
        print(f"✅ Vidéo YouTube indexée avec succès ({len(docs)} segments).")
        
    except Exception as e:
        print(f"❌ Échec total de l'indexation YouTube : {e}")
        raise e


def ingest_webpage(url: str, course_id: str):
    """Scrape, nettoie et indexe le contenu d'un site web pédagogique."""
    print(f"🌐 Archiviste : Scraping de la page Web : {url}")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
            tag.extract()
            
        text = soup.get_text(separator=' ', strip=True)
        
        doc = Document(
            page_content=text, 
            metadata={"course_id": course_id, "source": url, "type": "webpage", "page": 1}
        )
        
        splitter = RecursiveCharacterTextSplitter(chunk_size=1200, chunk_overlap=200)
        docs = splitter.split_documents([doc])
        
        Chroma.from_documents(documents=docs, embedding=_embeddings, persist_directory="./data/chroma_db")
        print(f"✅ Page Web indexée ({len(docs)} segments).")
    except Exception as e:
        print(f"❌ Erreur lors de l'analyse du site Web : {e}")
        raise e


def ingest_source(source_type: str, source_path_or_url: str, course_id: str):
    """Routeur principal pour l'ingestion automatique."""
    source_type = source_type.upper()
    
    if source_type == "PDF":
        return ingest_pdf(source_path_or_url, course_id)
    elif source_type in ["YOUTUBE", "VIDEO"]:
        return ingest_youtube(source_path_or_url, course_id)
    elif source_type == "WEBPAGE":
        return ingest_webpage(source_path_or_url, course_id)
    else:
        print(f"🚫 Type de source '{source_type}' non supporté.")

if __name__ == "__main__":
    pass