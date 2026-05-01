from langgraph.graph import StateGraph, END
from core.state import AgentState
from .architect import architect_node
from .writer import writer_node
from .assessor import assessor_node
from .critic import critic_node, should_continue
from .enricher import enricher_node

def create_course_graph():
    """
    Initialise et compile le workflow de génération de cours.
    Définit l'ordre de passage entre les agents et les conditions de sortie.
    """
    # Création du graphe basé sur l'état défini dans AgentState
    workflow = StateGraph(AgentState)
    
    # 1. Ajout des nœuds (Agents)
    # Chaque nœud correspond à une fonction spécialisée
    workflow.add_node("architect", architect_node)
    workflow.add_node("writer", writer_node)
    workflow.add_node("assessor", assessor_node)
    workflow.add_node("critic", critic_node)
    workflow.add_node("enricher", enricher_node)
    
    # 2. Définition du flux de travail (Workflow)
    # Le processus commence par l'architecte pour définir la structure
    workflow.set_entry_point("architect")
    
    # Flux linéaire : Architecte -> Rédacteur -> Évaluateur -> Critique
    workflow.add_edge("architect", "writer")
    workflow.add_edge("writer", "assessor")
    workflow.add_edge("assessor", "critic")
    
    # 3. Gestion de la boucle de rétroaction (Feedback Loop)
    # Après le critique, on vérifie si le cours est validé ou s'il faut rectifier
    workflow.add_conditional_edges(
        "critic",
        should_continue,
        {
            "rectify": "writer", # Recommencer l'écriture' avec le feedback du critique ou du prof
            "enricher": "enricher"  # Passer à la génération des exercices
        }
    )
    workflow.add_edge("enricher", END)
    
    # Compilation du graphe pour exécution
    return workflow.compile()