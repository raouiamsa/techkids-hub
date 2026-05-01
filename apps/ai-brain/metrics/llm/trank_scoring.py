import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline

class TrankScorer:
    """
    Readability Ranking using Hugging Face Transformers.
    This model classifies text into difficulty levels (Grades/Ranks).
    """
    def __init__(self, model_id="jtatman/bert-base-en-readability"):
        # We load a BERT-based model fine-tuned for readability
        # Plan A: Local loading using Transformers pipeline
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(model_id)
            self.model = AutoModelForSequenceClassification.from_pretrained(model_id)
            self.pipe = pipeline("text-classification", model=self.model, tokenizer=self.tokenizer)
            print(f"TRank Model '{model_id}' loaded successfully.")
        except Exception as e:
            print(f" Error loading TRank model: {e}")
            self.pipe = None

    def get_readability_rank(self, text):
        """
        Predicts the readability rank or grade level of the text.
        """
        if not self.pipe:
            return {"label": "Error", "score": 0.0}

        # Transformers have a limit of 512 tokens
        truncated_text = text[:1500] 
        
        try:
            result = self.pipe(truncated_text)
            # The result is usually a label like 'Grade 6' or '4th Grade'
            return {
                "rank_label": result[0]['label'],
                "confidence": round(result[0]['score'], 4)
            }
        except Exception as e:
            print(f" TRank Inference Error: {e}")
            return {"rank_label": "N/A", "confidence": 0.0}

# Example of standalone test
if __name__ == "__main__":
    scorer = TrankScorer()
    sample_text = "The cat sat on the mat. It was a very happy cat."
    print(f"Rank Result: {scorer.get_readability_rank(sample_text)}")