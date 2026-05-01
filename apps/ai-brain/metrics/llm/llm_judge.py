import os
import json
import requests
import json_repair
from dotenv import load_dotenv

load_dotenv()

class LLMJudge:
    """
    Evaluateur qualitatif avec systeme de basculement direct (Groq/NVIDIA).
    Plan A : Llama 3.3 70B Versatile (Groq Direct) - Intelligence superieure.
    Plan B : Llama 3.3 70B Instruct (NVIDIA NIM) - Secours robuste.
    """
    def __init__(self):
        # Configuration Plan A : GROQ DIRECT
        self.groq_key = os.getenv("GROQ_API_KEY")
        self.groq_url = "https://api.groq.com/openai/v1/chat/completions"
        self.model_a = "llama-3.3-70b-versatile"

        # Configuration Plan B : NVIDIA NIM
        self.nvidia_key = os.getenv("NVIDIA_API_KEY")
        self.nvidia_url = "https://integrate.api.nvidia.com/v1/chat/completions"
        self.model_b = "meta/llama-3.3-70b-instruct"

        if not self.groq_key or not self.nvidia_key:
            print("WARNING: Cles GROQ_API_KEY ou NVIDIA_API_KEY manquantes dans le .env")

    def _invoke_judge_with_fallback(self, system_prompt, user_content):
        """
        Tente le Plan A sur Groq, bascule sur Plan B NVIDIA si besoin.
        """
        payload = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            "max_tokens": 2048,
            "temperature": 0.1 # Temperature basse pour favoriser la stabilite du JSON[cite: 7]
        }

        # --- TENTATIVE PLAN A : GROQ DIRECT ---
        try:
            print(f"Audit : Tentative avec Plan A (Groq - {self.model_a})...")
            headers_a = {
                "Authorization": f"Bearer {self.groq_key}",
                "Content-Type": "application/json"
            }
            payload["model"] = self.model_a
            
            response = requests.post(self.groq_url, headers=headers_a, json=payload, timeout=30)
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]

        except Exception as e:
            print(f"Echec Plan A (Groq) : {e}. Basculement sur Plan B (NVIDIA NIM)...[cite: 7]")

            # --- TENTATIVE PLAN B : NVIDIA NIM ---
            try:
                headers_b = {
                    "Authorization": f"Bearer {self.nvidia_key}",
                    "Content-Type": "application/json"
                }
                payload["model"] = self.model_b
                
                response = requests.post(self.nvidia_url, headers=headers_b, json=payload, timeout=60)
                response.raise_for_status()
                return response.json()["choices"][0]["message"]["content"]
            
            except Exception as e_final:
                print(f"Echec critique des deux plans d'audit : {e_final}[cite: 7]")
                raise

    def evaluate_pedagogy(self, generated_text, target_age, subject):
        """
        Audit pedagogique avec instruction JSON stricte pour eviter le chatter[cite: 7].
        """
        system_prompt = f"""You are a Master Educational Auditor. 
Your task is to objectively evaluate a lesson for a {target_age} years old student.

CRITICAL INSTRUCTION: 
- Return ONLY the JSON object. 
- NO introductory text or conversational filler.
- STRICTLY valid JSON format.

OUTPUT FORMAT (JSON ONLY):
{{
    "score_out_of_100": <int>,
    "pedagogical_feedback": "<string>",
    "strengths": ["<string>"],
    "weaknesses": ["<string>"],
    "verdict": "<ACCEPTED or REJECTED>"
}}
"""
        user_input = f"SUBJECT: {subject}\nTARGET AGE: {target_age}\n\nCONTENT:\n{generated_text}"

        try:
            raw_response = self._invoke_judge_with_fallback(system_prompt, user_input)
            # Utilisation de json_repair pour une robustesse maximale[cite: 7]
            evaluation = json_repair.loads(raw_response)
            return evaluation
        except Exception as e:
            print(f"Erreur lors de l'audit pedagogique : {e}[cite: 7]")
            return {"score_out_of_100": 0, "verdict": "ERROR"}

    def evaluate_critic_feedback(self, critic_feedback, flawed_content):
        """
        Meta-evaluation du Critic avec suppression du chatter[cite: 7].
        """
        system_prompt = """You are a Supreme AI Auditor.
Rate the feedback out of 100 based on accuracy and actionability.

STRICT RULE: Return ONLY a valid JSON object. Do not talk to me.

{
    "critic_score": <int>,
    "missed_errors": ["<string>"],
    "verdict": "<Excellent, Average, or Poor>"
}
"""
        user_input = f"FLAWED CONTENT:\n{flawed_content}\n\nJUNIOR FEEDBACK:\n{critic_feedback}"

        try:
            raw_response = self._invoke_judge_with_fallback(system_prompt, user_input)
            meta_eval = json_repair.loads(raw_response)
            return meta_eval
        except Exception as e:
            print(f"Erreur lors de la meta-evaluation : {e}[cite: 7]")
            return {"critic_score": 0, "verdict": "ERROR"}

if __name__ == "__main__":
    judge = LLMJudge()
    print("Test du systeme Fallback Direct (Groq / NVIDIA)...[cite: 7]")
    content = "Le Python est un langage puissant et simple pour debuter."
    res = judge.evaluate_pedagogy(content, 12, "Python Intro")
    print(json.dumps(res, indent=2))