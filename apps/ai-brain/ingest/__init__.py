from .pdf import process_pdf
from .youtube import process_youtube
from .web import process_webpage

def ingest_source(source_type: str, source_path_or_url: str, course_id: str):
    """Routeur principal pour l'ingestion automatique."""
    source_type = source_type.upper()
    
    if source_type == "PDF":
        return process_pdf(source_path_or_url, course_id)
    elif source_type in ["YOUTUBE", "VIDEO"]:
        return process_youtube(source_path_or_url, course_id)
    elif source_type == "WEBPAGE":
        return process_webpage(source_path_or_url, course_id)
    else:
        print(f" Type de source '{source_type}' non supporté.")