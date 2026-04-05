from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import uvicorn
from ingest import ingest_pdf
from agents import create_course_graph

app = FastAPI(title="TechKids AI Brain")

# --- Modèles de Données ---
class IngestRequest(BaseModel):
    file_path: str
    course_id: str

class CourseRequest(BaseModel):
    input_request: str
    course_id: str
    age_group: int
    teacher_feedback: Optional[str] = ""

# --- Endpoints ---

@app.get("/")
async def root():
    return {"message": "Cerveau IA (ai-brain) en ligne !", "status": "ready"}

@app.post("/ingest")
async def api_ingest(req: IngestRequest):
    try:
        ingest_pdf(req.file_path, req.course_id)
        return {"status": "success", "message": f"Document {req.course_id} ingéré."}
    except Exception as e:
        import traceback
        print("=" * 60)
        print("ERREUR INGEST :")
        traceback.print_exc()
        print("=" * 60)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate")
async def api_generate(req: CourseRequest):
    try:
        graph = create_course_graph()
        initial_state = {
            "input_request": req.input_request,
            "course_id": req.course_id,
            "age_group": req.age_group,
            "teacher_feedback": req.teacher_feedback,
            "content": [],
            "iterations": 0,
            "source_documents": []   # ← Requis par le Critique (anti-hallucination)
        }
        
        result = graph.invoke(initial_state)
        
        return {
            "status": "success",
            "syllabus": result.get("syllabus"),
            "content": result.get("content", [])[-1] if result.get("content") else ""
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="localhost", port=8000, reload=True)
