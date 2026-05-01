import os
from langchain_huggingface import HuggingFaceEmbeddings
from dotenv import load_dotenv

load_dotenv()

# ── EMBEDDINGS LOCAUX PARTAGÉS ──
print("Archiviste : Chargement du modèle de vecteurs (multilingual-e5-small)...")
EMBEDDINGS = HuggingFaceEmbeddings(
    model_name="intfloat/multilingual-e5-small",
    model_kwargs={"device": "cpu"},
    encode_kwargs={"normalize_embeddings": True}
)

CHROMA_PERSIST_DIR = "./data/chroma_db"