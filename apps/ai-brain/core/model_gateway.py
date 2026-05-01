import os
import requests
import time
from dotenv import load_dotenv

load_dotenv()

class ModelGateway:
    """
    Passerelle centralisee pour appeler les modeles d'IA (NVIDIA, OpenRouter, Groq, Google).
    Gere les parametres specifiques et les limites de chaque fournisseur.
    """
    def __init__(self):
        self.nvidia_key = os.getenv("NVIDIA_API_KEY")
        self.openrouter_key = os.getenv("OPENROUTER_API_KEY")
        self.groq_key = os.getenv("GROQ_API_KEY")
        self.google_key = os.getenv("GOOGLE_API_KEY")

        # Verification minimale des cles essentielles
        if not self.groq_key:
            print("AVERTISSEMENT: GROQ_API_KEY manquante.")
        if not self.nvidia_key:
            print("AVERTISSEMENT: NVIDIA_API_KEY manquante.")

    def invoke(self, model_id, provider, sys_prompt, user_input):
        """
        Route la requete vers le fournisseur specifie dans la SELECTION_MATRIX.
        """
        provider = provider.lower()
        if provider == "nvidia":
            return self._invoke_nvidia(model_id, sys_prompt, user_input)
        elif provider == "openrouter":
            return self._invoke_openrouter(model_id, sys_prompt, user_input)
        elif provider == "groq":
            return self._invoke_groq(model_id, sys_prompt, user_input)
        elif provider == "google":
            return self._invoke_google(model_id, sys_prompt, user_input)
        else:
            raise ValueError(f"Provider inconnu: {provider}")

    def _invoke_groq(self, model_id, sys_prompt, user_input):
        """Appel direct a l'API Groq (format OpenAI)."""
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.groq_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": model_id,
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_input}
            ],
            "temperature": 0.2,
            "max_tokens": 4096, # Limite Groq pour eviter les erreurs 400
            "stream": False
        }

        try:
            # Timeout de 60 secondes pour Groq qui est generalement tres rapide
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"Erreur API Groq ({model_id}): {e}")
            return "ERROR_GENERATION_GROQ"

    def _invoke_google(self, model_id, sys_prompt, user_input):
        """Appel natif a l'API Google Gemini."""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={self.google_key}"
        headers = {"Content-Type": "application/json"}
        
        # Fusion du prompt systeme et de l'entree pour Gemini
        combined_prompt = f"{sys_prompt}\n\nInstruction utilisateur: {user_input}"
        
        payload = {
            "contents": [{
                "parts": [{"text": combined_prompt}]
            }],
            "generationConfig": {
                "temperature": 0.15,
                "maxOutputTokens": 2048
            }
        }

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=90)
            response.raise_for_status()
            return response.json()["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            print(f"Erreur API Google ({model_id}): {e}")
            return "ERROR_GENERATION_GOOGLE"

    def _invoke_nvidia(self, model_id, sys_prompt, user_input):
        """Appel natif a l'API NVIDIA avec gestion dynamique des tokens."""
        url = "https://integrate.api.nvidia.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.nvidia_key}",
            "Accept": "application/json"
        }

        # Adaptation des parametres selon le type de modele
        if "kimi" in model_id.lower() or "thinking" in model_id.lower():
            temp, max_tk = 1.0, 4096
        else:
            temp, max_tk = 0.15, 2048

        payload = {
            "model": model_id,
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_input}
            ],
            "max_tokens": max_tk,
            "temperature": temp,
            "stream": False
        }

        try:
            # Augmentation du timeout a 120s pour les modeles lourds sur NVIDIA
            response = requests.post(url, headers=headers, json=payload, timeout=120)
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"Erreur API NVIDIA ({model_id}): {e}")
            return "ERROR_GENERATION_NVIDIA"

    def _invoke_openrouter(self, model_id, sys_prompt, user_input):
        """Appel natif a l'API OpenRouter."""
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.openrouter_key}",
            "HTTP-Referer": "https://techkids-hub.com",
            "X-Title": "Benchmark AI"
        }

        payload = {
            "model": model_id,
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_input}
            ],
            "temperature": 0.2,
            "stream": False
        }

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"Erreur API OpenRouter ({model_id}): {e}")
            return "ERROR_GENERATION_OPENROUTER"