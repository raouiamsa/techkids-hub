from rouge_score import rouge_scorer
from readability import Readability # ReadabilityCalculator library

class LinguisticMetrics:
    def __init__(self):
        self.r_scorer = rouge_scorer.RougeScorer(['rougeL'], use_stemmer=True)

    def calculate(self, generated_text, reference_text):
        # 1. ROUGE-L (Fidelity to Joel Grus PDF)
        rouge_scores = self.r_scorer.score(reference_text, generated_text)
        
        # 2. Readability Indices
        # Equation de LIX : $LIX = \frac{A}{B} + \frac{C \times 100}{A}$
        try:
            r = Readability(generated_text)
            lix = r.lix().score
            ari = r.ari().score
        except:
            lix, ari = 0, 0 # Fallback si le texte est trop court pour le calcul
            
        return {
            "ROUGE-L": round(rouge_scores['rougeL'].fmeasure, 4),
            "LIX": round(lix, 2),
            "ARI": round(ari, 2)
        }