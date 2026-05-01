
import ast
import os
import requests
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed

# Mapping langage TechKids → identifiant Piston API
PISTON_LANGUAGE_MAP = {
    "JavaScript": "javascript",
    "TypeScript": "typescript",
    "Java":       "java",
    "C++":        "c++",
    "C":          "c",
    "PHP":        "php",
    "Ruby":       "ruby",
    "Go":         "go",
    "Rust":       "rust",
    "Swift":      "swift",
    "Kotlin":     "kotlin",
    "R":          "r",
}

PISTON_API_URL = "https://emkc.org/api/v2/piston/execute"
PISTON_TIMEOUT = 10  # secondes max par requête

# VALIDATION PYTHON — ast.parse() local
def _validate_python(code: str) -> dict:
    #Validation syntaxique Python via le parser natif (AST).
    try:
        ast.parse(code)
        return {
            "valid": True,
            "error": None,
            "method": "AST Local (Python)"
        }
    except SyntaxError as e:
        return {
            "valid": False,
            "error": f"SyntaxError ligne {e.lineno}: {e.msg}",
            "method": "AST Local (Python)"
        }
    except Exception as e:
        return {
            "valid": False,
            "error": str(e),
            "method": "AST Local (Python)"
        }


# VALIDATION AUTRES LANGAGES — Piston API

def _validate_with_piston(code: str, language: str) -> dict:
    #Validation via Piston API .
    piston_lang = PISTON_LANGUAGE_MAP.get(language, language.lower())

    try:
        response = requests.post(
            PISTON_API_URL,
            json={
                "language": piston_lang,
                "version": "*",  # Dernière version disponible
                "files": [{"content": code}],
            },
            timeout=PISTON_TIMEOUT
        )

        if response.status_code != 200:
            return {
                "valid": None,  # None = indéterminé (pas d'erreur connue)
                "error": f"Piston API HTTP {response.status_code}",
                "method": f"Piston API ({language})"
            }

        result = response.json()
        run = result.get("run", {})
        stderr = (run.get("stderr") or "").strip()
        exit_code = run.get("code", 0)

        is_valid = (exit_code == 0) and not stderr
        return {
            "valid": is_valid,
            "error": stderr if not is_valid else None,
            "method": f"Piston API ({language})"
        }

    except requests.Timeout:
        return {
            "valid": None,
            "error": "Timeout (>10s) — Piston API indisponible",
            "method": f"Piston API ({language})"
        }
    except Exception as e:
        return {
            "valid": None,
            "error": str(e),
            "method": f"Piston API ({language})"
        }

def validate_code(code: str, language: str) -> dict:
    """
    Valide un code selon le langage.
    RÈGLE : Appeler UNIQUEMENT sur exercise['solution'], jamais sur starterCode.
    """
    if not code or not code.strip():
        return {"valid": False, "error": "Code vide", "method": "Local"}

    if language == "Python":
        return _validate_python(code)
    elif language in PISTON_LANGUAGE_MAP:
        return _validate_with_piston(code, language)
    else:
        # Langage non supporté (ex: Scratch)
        return {"valid": None, "error": None, "method": f"Skipped ({language})"}



def validate_all_exercises(modules: list, language: str) -> list:
    """
    Valide tous les exercices de code d'un cours en parallèle.
    Retourne une liste de rapports d'erreurs (only failures).

    Structure de retour :
    [
      {
        "module": "Titre du Module",
        "exercise_title": "Titre exercice",
        "error": "SyntaxError ligne 3: ...",
        "method": "AST Local (Python)"
      },
      ...
    ]
    """
    tasks = []
    for mod in modules:
        mod_title = mod.get("title", "Module inconnu")
        exercises = mod.get("exercises_code", [])
        if not isinstance(exercises, list):
            continue

        for ex in exercises:
            if not isinstance(ex, dict):
                continue
            solution = ex.get("solution", "")
            ex_title = ex.get("title", "Exercice sans titre")
            if solution:
                tasks.append((mod_title, ex_title, solution))

    if not tasks:
        return []

    errors = []

    # Exécution parallèle pour éviter la latence cumulative
    with ThreadPoolExecutor(max_workers=min(len(tasks), 6)) as executor:
        future_map = {
            executor.submit(validate_code, solution, language): (mod_title, ex_title)
            for mod_title, ex_title, solution in tasks
        }

        for future in as_completed(future_map):
            mod_title, ex_title = future_map[future]
            try:
                result = future.result()
                if result.get("valid") is False:
                    errors.append({
                        "module": mod_title,
                        "exercise_title": ex_title,
                        "error": result.get("error", "Erreur inconnue"),
                        "method": result.get("method", "")
                    })
            except Exception as e:
                print(f" Validator : Exception sur {ex_title} : {e}")

    return errors
