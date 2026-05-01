import os
import pandas as pd
from datasets import Dataset
from ragas import evaluate, RunConfig
from ragas.metrics import faithfulness, answer_relevancy, context_precision, context_recall
from langchain_openai import ChatOpenAI
from langchain_core.messages import BaseMessage
from typing import List, Optional, Any

class SafeChatOpenAI(ChatOpenAI):
    """
    Surcharge de ChatOpenAI pour :
    1. Bloquer le paramètre 'n' (Error 400 sur Groq).
    2. Forcer le format JSON (JSON Mode) pour stabiliser RAGAS.
    """
    def _generate(self, messages: List[BaseMessage], stop: Optional[List[str]] = None, run_manager: Optional[Any] = None, **kwargs: Any):
        kwargs.pop("n", None)
        return super()._generate(messages, stop, run_manager, **kwargs)

    async def _agenerate(self, messages: List[BaseMessage], stop: Optional[List[str]] = None, run_manager: Optional[Any] = None, **kwargs: Any):
        kwargs.pop("n", None)
        return await super()._agenerate(messages, stop, run_manager, **kwargs)

from langchain_huggingface import HuggingFaceEmbeddings
from dotenv import load_dotenv

load_dotenv()

class RagasEvaluator:
    """
    Moteur d'evaluation RAGAS optimisé pour Groq (Economy Mode).
    Configuré pour un Safety Cap de 15,000 chars (Protection TPM/TPD).
    """
    def __init__(self):
        # Configuration Plan A (Llama 3.3 70B - Recommandé pour la logique JSON)
        self.llm_plan_a = SafeChatOpenAI(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            api_key=os.getenv("GROQ_API_KEY"),
            base_url="https://api.groq.com/openai/v1",
            temperature=0.1,
            max_tokens=4096,
            timeout=300,
            n=1
        )

        # Configuration Plan B (Llama 4 Scout)
        self.llm_plan_b = SafeChatOpenAI(
            model="llama-3.3-70b-versatile",
            api_key=os.getenv("GROQ_API_KEY"),
            base_url="https://api.groq.com/openai/v1",
            temperature=0.1,
            max_tokens=4096, # Augmenté pour éviter LLMDidNotFinishException
            timeout=300,
            n=1 
            
        )

        print("RAGAS: Initialisation des Embeddings locaux (E5-Small)...")
        self.embeddings = HuggingFaceEmbeddings(
            model_name="intfloat/multilingual-e5-small",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True}
        )

        self.metrics = [faithfulness, answer_relevancy, context_precision, context_recall]

        # Injection des instructions de sécurité sur chaque métrique
        for metric in self.metrics:
            if hasattr(metric, 'n'): metric.n = 1 
            if hasattr(metric, 'strictness'): metric.strictness = 1 
            
            if hasattr(metric, 'llm') and metric.llm is not None:
                if hasattr(metric.llm, 'n'): metric.llm.n = 1
                metric.llm.prompt_instruction = "Return ONLY a valid JSON object. No preamble, no chatter."

    def _execute_ragas_core(self, dataset, llm_instance):
        """Exécution du moteur avec batch_size=1 pour respecter le TPM."""
        run_config = RunConfig(timeout=300, max_retries=3)
        return evaluate(
            dataset=dataset,
            metrics=self.metrics,
            llm=llm_instance,
            embeddings=self.embeddings,
            run_config=run_config,
            batch_size=1 
        )

    def evaluate_generation(self, question, answer, context, ground_truth):
        """
        Évaluation avec Slicing à 15,000 chars (Sweet Spot Quota/Qualité).
        """
        try:
            # [SAFETY CAP]: Limite à 15k chars pour garantir le passage sous les 30k tokens
            safe_context = context[:15000] if context else ""
            safe_gt = ground_truth[:15000] if ground_truth else ""

            data = {
                "question": [question],
                "answer": [answer],
                "contexts": [[safe_context]],
                "ground_truth": [safe_gt]
            }
            dataset = Dataset.from_dict(data)

            try:
                print(f"RAGAS : Audit via Plan A ({self.llm_plan_a.model})...")
                result = self._execute_ragas_core(dataset, self.llm_plan_a)
            except Exception as e:
                print(f"Avertissement Plan A : {str(e)[:50]}. Switch Plan B.")
                result = self._execute_ragas_core(dataset, self.llm_plan_b)

            df_scores = result.to_pandas()
            scores_dict = df_scores.mean(numeric_only=True).to_dict()
            
            return {
                "faithfulness": round(scores_dict.get("faithfulness", 0.0), 4),
                "answer_relevancy": round(scores_dict.get("answer_relevancy", 0.0), 4),
                "context_precision": round(scores_dict.get("context_precision", 0.0), 4),
                "context_recall": round(scores_dict.get("context_recall", 0.0), 4)
            }
        except Exception as e:
            print(f"Erreur critique RAGAS : {e}")
            return {"faithfulness": 0.0, "answer_relevancy": 0.0, "context_precision": 0.0, "context_recall": 0.0}

if __name__ == "__main__":
    evaluator = RagasEvaluator()
    q = "Qu'est-ce qu'une liste en Python ?"
    a = "Une liste est une structure de données ordonnée et modifiable."
    res = evaluator.evaluate_generation(q, a, a, a)
    print(f"Résultats du test RAGAS : {res}")