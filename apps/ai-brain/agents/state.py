from typing import List, TypedDict

class AgentState(TypedDict):
    """
    Représente l'état partagé entre tous les agents du pipeline LangGraph.
    Ce dictionnaire centralise les données pour permettre une génération cohérente.
    """
    input_request: str           # La demande initiale du professeur (ex: "Introduction au Python")
    course_ids: List[str]        # Liste des identifiants des sources (PDF, URLs) sélectionnées
    syllabus: str                # Le plan de cours structuré généré par l'Architecte (JSON string)
    content: List[str]           # Historique des versions du contenu rédigé par Sophie Chen
    age_group: int               # Âge cible des élèves pour l'adaptation pédagogique
    level: str                   # Niveau de difficulté (BEGINNER, INTERMEDIATE, ADVANCED)
    teacher_feedback: str        # Commentaires ou directives de révision fournis par le professeur
    include_code_exercises: bool # Option pour activer la génération d'exercices de programmation
    iterations: int              # Compteur de cycles pour limiter les révisions automatiques
    source_documents: List[dict] # Métadonnées enrichies des sources (Page PDF, Minutes YouTube, etc.)
    draft_id: str                # Identifiant unique du brouillon pour la communication avec NestJS
    
    # ── ÉVALUATIONS ET PROJETS (RICH CONTENT) ──
    placement_bank: str          # Questions QCM de diagnostic initial (JSON string)
    certification_bank: str      #Banque de 20 questions pour l'examen final (JSON string)
    final_project: str           # Énoncé, étapes et solution du projet de synthèse (JSON string)
    programming_language: str    # Langage technique détecté ou choisi pour le cours (ex: Python, C++)