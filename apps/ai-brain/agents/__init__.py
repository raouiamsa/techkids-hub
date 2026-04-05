from langgraph.graph import StateGraph, END
from .state import AgentState
from .architect import architect_node
from .writer import writer_node
from .critic import critic_node, should_continue

def create_course_graph():
    workflow = StateGraph(AgentState)
    
    # 1. Ajout des nœuds
    workflow.add_node("architect", architect_node)
    workflow.add_node("writer", writer_node)
    workflow.add_node("critic", critic_node)
    
    # 2. Définition du flux (commençant par l'architect puis le rédacteur et enfin le critique(modification))
    workflow.set_entry_point("architect")
    workflow.add_edge("architect", "writer")
    workflow.add_edge("writer", "critic")
    
    # 3. Boucle de rectification (HITL)
    workflow.add_conditional_edges(
        "critic",
        should_continue,
        {
            "rectify": "architect", # Recommencer avec le feedback
            "end": END              # Terminer
        }
    )
    
    return workflow.compile()
