import os
import json
import asyncio
import aiohttp
import aio_pika
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from ingest import ingest_source
from agents import create_course_graph

# --- Configuration du Worker (RabbitMQ) ---
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://techkids:techkids@localhost:5672/")
QUEUE_NAME   = "techkids_main_queue"
EVENT_NAME   = "source.indexing.requested"
API_WEBHOOK  = "http://localhost:3000/api/ai/content-sources"

# --- Fonctions du Worker (Tâches en arrière-plan) ---

async def notify_gateway(source_id: str, status: str):
    """Notifie NestJS de la fin ou de l'échec de l'indexation (READY/ERROR)."""
    url = f"{API_WEBHOOK}/{source_id}/status"
    async with aiohttp.ClientSession() as session:
        try:
            await session.patch(url, json={"status": status})
            print(f"Webhook notifie : source {source_id} -> {status}")
        except Exception as e:
            print(f"Erreur lors de la notification du statut : {e}")

async def process_rabbitmq_message(message: aio_pika.IncomingMessage):
    """Traite les messages de RabbitMQ pour lancer l'ingestion asynchrone."""
    async with message.process():
        try:
            payload = json.loads(message.body.decode())
            data = payload.get("data", payload)
            pattern = payload.get("pattern")

            if pattern != EVENT_NAME:
                return

            source_id   = data.get("sourceId")
            source_type = data.get("type", "PDF")
            file_path   = data.get("filePath")
            url         = data.get("url")
            
            print(f"Background : Debut de l'indexation pour {source_id} ({source_type})...")

            # Le chemin depend du type de source
            source_path = file_path if source_type.upper() == "PDF" else url
            
            # Utilisation de asyncio.to_thread pour ne pas bloquer l'Event Loop
            await asyncio.to_thread(ingest_source, source_type, source_path, source_id)

            print(f"Background : Indexation terminee pour {source_id}")
            await notify_gateway(source_id, "READY")

        except Exception as e:
            import traceback
            print(f"Background Error : {e}")
            traceback.print_exc()
            source_id = data.get("sourceId") if 'data' in locals() and isinstance(data, dict) else None
            if source_id:
                await notify_gateway(source_id, "ERROR")

async def start_background_worker():
    """Ecoute continue de la file RabbitMQ."""
    print("Worker en arriere-plan demarre, pret pour l'indexation...")
    try:
        connection = await aio_pika.connect_robust(RABBITMQ_URL)
        async with connection:
            channel = await connection.channel()
            await channel.set_qos(prefetch_count=1)
            queue = await channel.declare_queue(QUEUE_NAME, durable=True)
            async with queue.iterator() as queue_iter:
                async for message in queue_iter:
                    await process_rabbitmq_message(message)
    except Exception as e:
        print(f"Probleme de connexion au Worker : {e}")

# --- Gestion du cycle de vie (FastAPI Lifespan) ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Lancement du Worker RabbitMQ au demarrage de l'API
    worker_task = asyncio.create_task(start_background_worker())
    print("API et Worker synchronises.")
    yield
    # Arret propre
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        print("Worker arrete proprement.")

# --- Configuration de l'API ---

app = FastAPI(title="TechKids AI Brain", lifespan=lifespan)

# --- Modeles de données (Pydantic) ---

class IngestRequest(BaseModel):
    file_path: Optional[str] = None
    url: Optional[str] = None
    type: str = "PDF"
    course_id: str

class CourseRequest(BaseModel):
    input_request: str
    course_ids: List[str]
    age_group: int
    level: str = "BEGINNER"
    teacher_feedback: Optional[str] = ""
    include_code_exercises: bool = False
    draft_id: Optional[str] = None
    programming_language: Optional[str] = "" 

class PracticeRequest(BaseModel):
    concept: str
    age_group: int
    level: str = "BEGINNER"
    student_mistake: Optional[str] = ""
    is_success: bool = False
    language: str = "Python"

# --- Points d'Entree (Endpoints) ---

@app.get("/")
async def root():
    return {"message": "Cerveau IA en ligne (Architecture Modulaire) !", "status": "ready"}

@app.post("/ingest")
async def api_ingest(req: IngestRequest):
    """Indexation manuelle d'une source."""
    try:
        source_path = req.file_path if req.type.upper() == "PDF" else req.url
        await asyncio.to_thread(ingest_source, req.type, source_path, req.course_id)
        return {"status": "success", "message": f"Source {req.course_id} ingeree avec succes."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate")
async def api_generate(req: CourseRequest):
    """Generation de cours riche via LangGraph (Sophie Chen)."""
    try:
        graph = create_course_graph()
        initial_state = {
            "input_request": req.input_request,
            "course_ids": req.course_ids,
            "age_group": req.age_group,
            "level": req.level,
            "teacher_feedback": req.teacher_feedback,
            "include_code_exercises": req.include_code_exercises,
            "draft_id": req.draft_id,
            "content": [],
            "iterations": 0,
            "source_documents": [],
            "programming_language": req.programming_language or "Python"
        }
        
        # Invocation du graphe d'agents
        result = await asyncio.to_thread(graph.invoke, initial_state)
        
        return {
            "status": "success",
            "syllabus": result.get("syllabus"),
            "content": result.get("content", [])[-1] if result.get("content") else "",
            "placement_bank": result.get("placement_bank"),
            "certification_bank": result.get("certification_bank"),
            "final_project": result.get("final_project"),
            "programming_language": result.get("programming_language"),
            "sources": result.get("source_documents", []) # Retourne les citations precises pour le Front
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-practice")
async def api_generate_practice(req: PracticeRequest):
    """Generation d'un Mini-Module Practice More (Remediation ou Renforcement)."""
    try:
        from agents.practice import generate_practice_module
        module = await asyncio.to_thread(
            generate_practice_module,
            req.concept,
            req.age_group,
            req.level,
            req.student_mistake,
            req.is_success,
            req.language
        )
        return {"status": "success", "module": module}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)