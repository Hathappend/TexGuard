import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

class IndoBERTweetClassifier:
    def __init__(self, model_path: str = "./models"):
        self.MODEL_PATH = model_path
        self.LABELS_MAP = ['toxic', 'hate_speech', 'cyberbullying', 'spam_judol', 'spam_emot']
        self.THRESHOLD = 0.50
        self.device = torch.device("cpu")
        self.tokenizer = None
        self.model = None

    def loadModel(self) -> None:
        print(f"[INFO] Memuat Model AI dari: {self.MODEL_PATH}...")
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(self.MODEL_PATH)
            self.model = AutoModelForSequenceClassification.from_pretrained(self.MODEL_PATH)
            self.model.to(self.device)
            self.model.eval()
            print("[OK] Model Siap!")
        except Exception as e:
            print(f"[ERROR] Error fatal saat load model: {e}")

    def executeInference(self, texts: list[str]) -> list[float]:
        if not self.tokenizer or not self.model:
            raise RuntimeError("Model belum dimuat.")
        
        inputs = self.tokenizer(
            texts, 
            return_tensors="pt", 
            truncation=True, 
            padding=True, 
            max_length=128
        ).to(self.device)

        with torch.no_grad():
            logits = self.model(**inputs).logits
        
        probs = torch.sigmoid(logits).cpu().numpy()
        return probs.tolist()

    def determineFinalLabel(self, prob_scores: list[float]) -> dict:
        scores_dict = {label: float(score) for label, score in zip(self.LABELS_MAP, prob_scores)}
        final_cat = "normal"
        final_conf = 0.0

        if scores_dict['spam_judol'] > self.THRESHOLD:
            final_cat = 'spam'
            final_conf = scores_dict['spam_judol']
        elif scores_dict['spam_emot'] > self.THRESHOLD:
            final_cat = 'spam'
            final_conf = scores_dict['spam_emot']
        else:
            max_toxic_val = 0
            max_toxic_label = ""
            for l in ['toxic', 'hate_speech', 'cyberbullying']:
                if scores_dict[l] > max_toxic_val:
                    max_toxic_val = scores_dict[l]
                    max_toxic_label = l
            
            if max_toxic_val > self.THRESHOLD:
                final_cat = max_toxic_label
                final_conf = max_toxic_val

        return {"category": final_cat, "confidence": final_conf}
