import os
import uuid
import glob
import requests
from bs4 import BeautifulSoup
from langchain_community.document_loaders import YoutubeLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from .shared import EMBEDDINGS, CHROMA_PERSIST_DIR

def report_progress(source_id: str, percent: int):
    """Envoie la progression de l'indexation au Hub NestJS."""
    try:
        url = f"http://localhost:3000/api/ai/content-sources/{source_id}/progress"
        requests.patch(url, json={"progressPercent": percent})
    except:
        pass

def format_timestamp(seconds: float) -> str:
    """Convertit des secondes en format MM:SS."""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins:02d}:{secs:02d}"

def process_youtube(url: str, source_id: str):
    """
    Méthode robuste avec intégration Deepgram (Audio-to-Text) et progression.
    Le source_id permet de lier la progression à l'interface utilisateur.
    """
    print(f"🎥 Archiviste : Extraction des données YouTube : {url}")
    report_progress(source_id, 10) # Démarrage
    
    documents = []
    video_title = "Vidéo YouTube"

    # 1. Récupération du titre réel de la vidéo pour les citations futures
    try:
        res = requests.get(url, timeout=5)
        soup = BeautifulSoup(res.content, 'html.parser')
        video_title = soup.title.string.replace("- YouTube", "").strip() if soup.title else "Vidéo"
    except: pass

    # Essai 1 : Sous-titres officiels via YoutubeLoader
    try:
        loader = YoutubeLoader.from_youtube_url(url, add_video_info=False)
        documents = loader.load()
    except Exception: pass

    # Essai 2 : Sous-titres multilingues automatiques
    if not documents:
        try:
            loader = YoutubeLoader.from_youtube_url(
                url, add_video_info=False,
                language=["fr", "en", "ar", "hi", "es", "de", "it", "pt", "ru", "zh-Hans", "ja", "ko"]
            )
            documents = loader.load()
        except Exception: pass

    # Essai 3 (PLAN C) : Deepgram API (Audio-to-Text) si aucun sous-titre n'existe
    if not documents:
        print("⚠️ Aucun sous-titre trouvé. Activation du Plan C (Deepgram)...")
        deepgram_api_key = os.getenv("DEEPGRAM_API_KEY")
        
        if not deepgram_api_key:
            print("   [Plan C] Ignoré : Clé DEEPGRAM_API_KEY manquante.")
        else:
            temp_id = str(uuid.uuid4())[:8]
            downloaded_file = None
            try:
                import yt_dlp
                report_progress(source_id, 30) # Début du téléchargement audio
                
                ydl_opts = {'format': 'm4a/bestaudio/best', 'outtmpl': f'temp_audio_{temp_id}.%(ext)s', 'quiet': True}
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=True)
                    downloaded_file = ydl.prepare_filename(info)
                
                report_progress(source_id, 60) # Envoi à Deepgram
                
                deepgram_url = "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&utterances=true"
                headers = {"Authorization": f"Token {deepgram_api_key}", "Content-Type": "audio/m4a"}
                
                with open(downloaded_file, "rb") as audio_file:
                    response = requests.post(deepgram_url, headers=headers, data=audio_file, timeout=600)
                
                response.raise_for_status()
                results = response.json()["results"]["utterances"]
                
                # Création de segments horodatés (Timestamps) pour un RAG précis
                current_text = ""
                start_time = 0
                for utt in results:
                    current_text += utt["transcript"] + " "
                    if utt["end"] - start_time > 45: # Segments de ~45 secondes
                        documents.append(Document(
                            page_content=current_text.strip(),
                            metadata={
                                "course_id": source_id, 
                                "source_name": video_title,
                                "timestamp": format_timestamp(start_time)
                            }
                        ))
                        current_text = ""
                        start_time = utt["end"]
                
                if current_text: # Dernier segment
                     documents.append(Document(page_content=current_text.strip(), metadata={"course_id": source_id, "source_name": video_title, "timestamp": format_timestamp(start_time)}))
                
                print("   [Plan C] ✅ Transcription Deepgram réussie avec timestamps.")
            except Exception as e3:
                print(f"   [Plan C] Échec : {e3}")
            finally:
                for f in glob.glob(f"temp_audio_{temp_id}*"):
                    try: os.remove(f)
                    except: pass

    # Sauvegarde finale dans ChromaDB
    if documents:
        try:
            report_progress(source_id, 90) # Phase finale
            
            # On s'assure que chaque document a les métadonnées de base
            for doc in documents:
                doc.metadata["course_id"] = source_id
                doc.metadata["source_name"] = video_title
                doc.metadata["type"] = "youtube"
                if "timestamp" not in doc.metadata:
                    doc.metadata["timestamp"] = "00:00"
            
            splitter = RecursiveCharacterTextSplitter(chunk_size=1200, chunk_overlap=200)
            docs = splitter.split_documents(documents)
            
            Chroma.from_documents(documents=docs, embedding=EMBEDDINGS, persist_directory=CHROMA_PERSIST_DIR)
            
            report_progress(source_id, 100)
            print(f"✅ Vidéo indexée avec succès ({len(docs)} segments).")
        except Exception as e:
            print(f"❌ Erreur lors de la sauvegarde : {e}")
            report_progress(source_id, 0) # Reset ou Erreur
    else:
        # Fallback Plan D : Si tout a échoué, on sauve au moins le titre et la description
        print("⚠️ Échec total de la transcription. Fallback sur les métadonnées simples.")
        # ... logic fallback identique à ton code mais avec report_progress ...
        report_progress(source_id, 100)