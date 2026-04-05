from typing import List, TypedDict

class AgentState(TypedDict):
    input_request: str
    course_id: str
    syllabus: str
    content: List[str]
    age_group: int
    teacher_feedback: str        # Le retour du prof pour corriger
    iterations: int              # Sécurité pour éviter les boucles infinies
    source_documents: List[dict] # Trace des documents utilisés (métadonnées)
