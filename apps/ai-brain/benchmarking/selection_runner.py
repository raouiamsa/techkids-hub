import pandas as pd
import os
import sys
import ast
import time
import csv

# ==========================================
# 0. Configuration et Initialisation
# ==========================================

# Configuration de sécurité pour RAGAS/LangChain
os.environ["OPENAI_API_KEY"] = "sk-fake-key-just-to-bypass-error"

from langchain_community.document_loaders import PyPDFLoader
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

# Ajout du répertoire racine au path pour les imports locaux
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.model_gateway import ModelGateway
from core.prompts_library import (
    get_writer_module_prompt,
    get_practice_exercise_prompt,
    get_critic_eval_prompt
)
from metrics.llm.linguistic_scores import LinguisticMetrics
from metrics.llm.ragas_engine import RagasEvaluator
from metrics.llm.llm_judge import LLMJudge

print("Connexion a ChromaDB...")
EMBEDDINGS = HuggingFaceEmbeddings(
    model_name="intfloat/multilingual-e5-small",
    model_kwargs={"device": "cpu"}
)

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROMA_PERSIST_DIR = os.path.join(ROOT_DIR, "data", "chroma_db")
vector_store = Chroma(persist_directory=CHROMA_PERSIST_DIR, embedding_function=EMBEDDINGS)

# --- Utilitaires ---

def retrieve_from_chroma(query, k=4):
    """Récupère les segments pertinents depuis ChromaDB."""
    try:
        results = vector_store.similarity_search(query, k=k)
        return "\n\n".join([doc.page_content for doc in results]) if results else ""
    except Exception as e:
        print(f"Erreur Retrieval: {e}")
        return "Retrieval Error"

def load_split_pdf(file_name):
    """Charge le contenu INTEGRAL d'un PDF."""
    file_path = os.path.join(ROOT_DIR, "data", file_name)
    try:
        loader = PyPDFLoader(file_path)
        return " ".join([p.page_content for p in loader.load()]).replace('\n', ' ').strip()
    except Exception as e:
        print(f"Erreur PDF {file_name}: {e}")
        return "Reference missing"

def _validate_python(code_str):
    """Vérifie la syntaxe Python du code généré."""
    clean_code = code_str.split("```python")[-1].split("```")[0] if "```" in code_str else code_str
    try:
        ast.parse(clean_code)
        return {"valid": True, "error": None}
    except Exception as e:
        return {"valid": False, "error": str(e)}

def save_incremental_csv(entry, filename="Mega_Hybrid_Backup_StepByStep.csv"):
    """Sauvegarde les résultats ligne par ligne."""
    try:
        file_exists = os.path.isfile(filename)
        with open(filename, mode='a', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=entry.keys())
            if not file_exists:
                writer.writeheader()
            writer.writerow(entry)
    except PermissionError:
        print(f"ERREUR: Veuillez fermer le fichier {filename} pour permettre l'ecriture.")

# ==========================================
# 1. Matrice de Selection (Configuration stable)
# ==========================================

SELECTION_MATRIX = {
    "Writer": [
        {"id": "mistralai/mistral-nemotron", "p": "nvidia", "name": "NVIDIA: Mistral Nemotron"},
        {"id": "llama-3.3-70b-versatile", "p": "groq", "name": "GROQ: Llama 3.3 70B"}
    ],
    "Practice": [
        {"id": "qwen/qwen3-coder-480b-a35b-instruct", "p": "nvidia", "name": "NVIDIA: Qwen 3 Coder"},
        {"id": "llama-3.1-8b-instant", "p": "groq", "name": "GROQ: Llama 8B (Speed)"}
    ],
    "Critic": [
        {"id": "llama-3.3-70b-versatile", "p": "groq", "name": "GROQ: Llama 3.3 70B"},
        {"id": "meta-llama/llama-4-scout-17b-16e-instruct", "p": "groq", "name": "GROQ: Llama 4 Scout"}
    ]
}

TEST_SUBJECTS = [
    {"type": "Theory", "topic": "Data Science Intro", "question": "Define Data Science?", "ref": load_split_pdf("Data Science from Scratch by Joel Grus Intro.pdf")},
    {"type": "Math", "topic": "Vectors", "question": "What is a vector?", "ref": load_split_pdf("Data Science from Scratch by Joel Grus linear algebra.pdf")},
    {"type": "Code", "topic": "Lists/Loops", "question": "How to use loops?", "ref": load_split_pdf("Data Science from Scratch by Joel Grus python.pdf")}
]

FLAWED_TEXT = "Les listes Python sont immuables. On ne peut pas faire de boucles sur un dictionnaire."

# ==========================================
# 2. Boucle de Benchmarking
# ==========================================

def run_selection_lab():
    print("Initialisation du Benchmarking (Stabilisé - 1 Run - Safety Cap 15k)...")
    gateway = ModelGateway()
    linguistic = LinguisticMetrics()
    ragas = RagasEvaluator() 
    pedagogical_judge = LLMJudge() 
    
    final_results = []
    checkpoint_file = "Mega_Hybrid_Backup_StepByStep.csv"

    if os.path.exists(checkpoint_file):
        os.remove(checkpoint_file)

    for sub in TEST_SUBJECTS:
        for age in [10, 14, 17]:
            for role, candidates in SELECTION_MATRIX.items():
                modes = ["ISOLE_PDF", "E2E_CHROMADB"] if role == "Writer" else ["ISOLE_PDF"]
                
                for cand in candidates:
                    for test_mode in modes:
                        # [MODIFICATION]: Une seule itération (1 Run) pour préserver le quota TPD
                        for run_id in range(1, 2): 
                            print(f">> EXECUTION: {role} | {cand['name']} | Age: {age} | Run: {run_id}/1")
                            
                            entry = {
                                "Run_ID": run_id,
                                "Test_Mode": test_mode, "Subject": sub['type'], "Age": age, 
                                "Role": role, "Model": cand['name'], "Generated_Output": "",
                                "Judge_Score_100": 0, "RAGAS_Faithfulness": 0, "RAGAS_Relevancy": 0,
                                "RAGAS_Precision": 0, "RAGAS_Recall": 0, "LIX_Readability": 0,
                                "Critic_Performance_Score": 0, "Code_Syntax_Valid": 0
                            }
                            
                            context = sub['ref'] if test_mode == "ISOLE_PDF" else retrieve_from_chroma(sub['question'])

                            # --- Étape 1 : Génération ---
                            try:
                                if role == "Writer":
                                    sys_p = get_writer_module_prompt(age, "BEGINNER", "Intro", sub['topic'], "Python", context, "", "", 1, 0)
                                    usr_p = f"Redige le cours detaille sur {sub['topic']}."
                                elif role == "Practice":
                                    sys_p = get_practice_exercise_prompt("Python", age, "Application", sub['topic'], "Age-adapted")
                                    usr_p = f"Genere un exercice pratique sur {sub['topic']}."
                                else:
                                    sys_p = get_critic_eval_prompt("Python", age, FLAWED_TEXT, "Pedagogical Accuracy")
                                    usr_p = "Evalue la qualite de ce texte."

                                output = gateway.invoke(cand['id'], cand['p'], sys_p, usr_p)
                                entry["Generated_Output"] = output
                                
                                # Pause pour stabiliser le TPM de Groq/Nvidia
                                time.sleep(10) 
                            except Exception as e:
                                entry["Generated_Output"] = f"ERROR: {str(e)}"
                                output = "ERROR"

                            # --- Étape 2 : Évaluation ---
                            if "ERROR" not in output:
                                try:
                                    if role == "Writer":
                                        scores = pedagogical_judge.evaluate_pedagogy(output, age, sub['topic'])
                                        
                                        # [CORRECTION CRITIQUE]: Safety Cap à 15,000 caractères.
                                        # Indispensable pour rester sous la limite de 30,000 TPM (Token Per Minute).
                                        safe_context = context[:15000] if context else ""
                                        safe_ref = sub['ref'][:15000] if sub['ref'] else ""
                                        
                                        r_scores = ragas.evaluate_generation(sub['question'], output, safe_context, safe_ref)
                                        l_stats = linguistic.calculate(output, sub['ref'])
                                        
                                        entry.update({
                                            "Judge_Score_100": scores.get("score_out_of_100", 0),
                                            "RAGAS_Faithfulness": r_scores.get("faithfulness", 0),
                                            "RAGAS_Relevancy": r_scores.get("answer_relevancy", 0),
                                            "RAGAS_Precision": r_scores.get("context_precision", 0),
                                            "RAGAS_Recall": r_scores.get("context_recall", 0),
                                            "LIX_Readability": l_stats.get("LIX", 0)
                                        })
                                    elif role == "Critic":
                                        c_eval = pedagogical_judge.evaluate_critic_feedback(output, FLAWED_TEXT)
                                        entry["Critic_Performance_Score"] = c_eval.get("critic_score", 0)
                                    elif role == "Practice":
                                        entry["Code_Syntax_Valid"] = 1 if _validate_python(output)["valid"] else 0
                                except Exception as eval_err:
                                    print(f"Erreur d'evaluation : {eval_err}")

                            save_incremental_csv(entry, checkpoint_file)
                            final_results.append(entry)

    print("\nGeneration du rapport final...")
    try:
        df = pd.DataFrame(final_results)
        df.to_excel("Mega_Hybrid_Benchmark_FINAL_STABLE.xlsx", index=False)
        print("Benchmark TERMINE avec succes.")
    except Exception as e:
        print(f"Erreur Excel: {e}")

if __name__ == "__main__":
    run_selection_lab()