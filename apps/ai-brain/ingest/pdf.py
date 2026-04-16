import os
import fitz  # PyMuPDF
from PIL import Image
import io
import requests
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from .shared import EMBEDDINGS, CHROMA_PERSIST_DIR
from tqdm import tqdm

# ── VISION LOCALE (Florence-2-base) ──
_florence_model = None
_florence_processor = None

def _load_florence():
    """Charge le modèle de vision avec le patch pour Windows."""
    global _florence_model, _florence_processor
    if _florence_model is not None: return
    
    print("\n🧠 Archiviste : Chargement de l'IA de vision Florence-2...")
    import torch
    import transformers.dynamic_module_utils
    
    # Patch pour éviter l'erreur flash_attn sur Windows
    _original_get_imports = transformers.dynamic_module_utils.get_imports
    transformers.dynamic_module_utils.get_imports = lambda f: [i for i in _original_get_imports(f) if i != "flash_attn"]
    
    from transformers import AutoProcessor, AutoModelForCausalLM
    
    # Choix du device (priorité au GPU si disponible)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    _florence_processor = AutoProcessor.from_pretrained("microsoft/Florence-2-base", trust_remote_code=True)
    _florence_model = AutoModelForCausalLM.from_pretrained(
        "microsoft/Florence-2-base", 
        torch_dtype=torch.float32, 
        trust_remote_code=True
    ).to(device)
    
    _florence_model.eval()

def _florence_task(image_pil, task):
    """Exécute une tâche de vision (OCR ou Description)."""
    import torch
    _load_florence()
    device = next(_florence_model.parameters()).device
    
    inputs = _florence_processor(text=task, images=image_pil, return_tensors="pt").to(device)
    with torch.no_grad():
        generated_ids = _florence_model.generate(
            input_ids=inputs["input_ids"], 
            pixel_values=inputs["pixel_values"], 
            max_new_tokens=512, 
            num_beams=3
        )
    result = _florence_processor.batch_decode(generated_ids, skip_special_tokens=False)[0]
    return _florence_processor.post_process_generation(result, task=task, image_size=(image_pil.width, image_pil.height)).get(task, "")

def report_progress(source_id: str, percent: int):
    """Envoie la progression de l'indexation au Hub NestJS."""
    try:
        url = f"http://localhost:3000/api/ai/content-sources/{source_id}/progress"
        requests.patch(url, json={"progressPercent": percent})
    except:
        pass

# Mots-clés pour détecter si une page contient potentiellement une figure pédagogique
FIGURE_KEYWORDS = {"figure", "fig.", "tableau", "schéma", "graphique", "graphe", "diagramme", "table"}

def process_pdf(file_path: str, source_id: str):
    """
    Analyse complète d'un PDF : Texte + Images + OCR.
    Le source_id ici correspond à l'ID de la source dans ta base de données.
    """
    if not os.path.exists(file_path):
        print(f"❌ Erreur : Le fichier {file_path} n'existe pas.")
        return

    file_name = os.path.basename(file_path)
    print(f"\n📑 Archiviste : Lecture approfondie de {file_name}...")
    
    # 0% -> 10% : Chargement initial
    report_progress(source_id, 10)
    
    loader = PyPDFLoader(file_path)
    documents = loader.load()
    
    # 10% -> 30% : Extraction du texte numérique
    report_progress(source_id, 30)
    
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1200, 
        chunk_overlap=200, 
        separators=["\n\n", "\n", ".", "!", "?", " "]
    )
    texts = text_splitter.split_documents(documents)

    # 30% -> 50% : Préparation de l'analyse visuelle
    report_progress(source_id, 50)

    doc_images = fitz.open(file_path)
    ocr_enrichments = {}
    visual_contexts = []
    
    pages_count = len(doc_images)
    print(f"🔍 Analyse visuelle de {pages_count} pages...")
    
    for page_idx in tqdm(range(pages_count), desc="Analyse des pages"):
        # Calcul de progression dynamique (plage 50% -> 90%)
        current_p = 50 + int((page_idx / pages_count) * 40)
        if page_idx % 5 == 0: report_progress(source_id, current_p)

        page = doc_images[page_idx]
        images = page.get_images(full=True)
        if not images: continue

        try:
            xref = images[0][0]
            base_image = doc_images.extract_image(xref)
            image_pil = Image.open(io.BytesIO(base_image["image"])).convert("RGB")
            
            # ✨ Filtrage : On ignore les petits logos ou icônes
            if image_pil.width < 250 or image_pil.height < 250:
                continue
            
            # OCR visuel
            ocr_text = _florence_task(image_pil, "<OCR>")
            if ocr_text and len(ocr_text.strip()) > 20: 
                ocr_enrichments[page_idx] = ocr_text
            
            # Description détaillée si un mot-clé de figure est présent sur la page
            if any(kw in page.get_text().lower() for kw in FIGURE_KEYWORDS):
                description = _florence_task(image_pil, "<DETAILED_CAPTION>")
                if description:
                    visual_contexts.append(Document(
                        page_content=f"[DESCRIPTION VISUELLE PAGE {page_idx+1}] : {description}", 
                        metadata={
                            "course_id": source_id, 
                            "source_name": file_name, 
                            "page": page_idx+1, 
                            "type": "visual"
                        }
                    ))
        except Exception: 
            continue
            
    doc_images.close()

    # Fusion des données et ajout des métadonnées de citation
    final_docs = []
    for t in texts:
        t.metadata["course_id"] = source_id
        t.metadata["source_name"] = file_name # 🌟 Crucial pour les citations
        page_num = t.metadata.get("page", -1)
        
        # Enrichissement avec le texte extrait des images de la même page
        if page_num - 1 in ocr_enrichments: 
            t.page_content += f"\n\n[TEXTE IMAGE PAGE {page_num}] : {ocr_enrichments[page_num - 1]}"
        final_docs.append(t)
        
    final_docs.extend(visual_contexts)

    # 90% -> 100% : Sauvegarde finale dans ChromaDB
    print(f"📥 Sauvegarde de {len(final_docs)} segments dans le cerveau...")
    Chroma.from_documents(documents=final_docs, embedding=EMBEDDINGS, persist_directory=CHROMA_PERSIST_DIR)
    
    report_progress(source_id, 100)
    print(f"✅ Ingestion PDF terminée avec succès pour {file_name}.")