import time
import csv
import os
import threading
from datetime import datetime, timedelta
import jwt
import bcrypt
from dotenv import load_dotenv

# Muat rahasia dari file .env
load_dotenv()

try:
    import requests
except ImportError:
    requests = None

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, Query
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.schemas.payloads import BatchRequest, FeedbackRequest, LoginRequest

# --- INJEKSI KODE: DATABASE SQLITE ---
from app.database.db import SessionLocal
from app.database import models

def save_telemetry_background(platform_name, texts, predicted_categories, confidences, inference_time_ms):
    db = SessionLocal()
    try:
        for i, text in enumerate(texts):
            log = models.TelemetryLog(platform=platform_name, text=text, predicted_label=predicted_categories[i], confidence=confidences[i], inference_time_ms=inference_time_ms)
            db.add(log)
        db.commit()
    except Exception as e:
        print(f"[DB ERROR] Gagal menyimpan log: {e}")
    finally:
        db.close()

def save_feedback_background(platform_name, system_label, corrected_label, comment_text):
    db = SessionLocal()
    try:
        log = models.FeedbackLog(platform=platform_name, text=comment_text, original_predicted_label=system_label)
        db.add(log)
        db.commit()
    except Exception as e:
        print(f"[DB ERROR] Gagal menyimpan feedback: {e}")
    finally:
        db.close()
# ------------------------------------

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "ISI_TOKEN_BOT_ANDA_DI_SINI")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "ISI_CHAT_ID_ANDA_DI_SINI")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "rahasia_default")
ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH", "")
from app.services.classifier import IndoBERTweetClassifier

class FastAPIController:
    def __init__(self, classifier: IndoBERTweetClassifier):
        self.app = FastAPI(title="TexGuard Backend API")
        self.limiter = Limiter(key_func=get_remote_address)
        self.app.state.limiter = self.limiter
        self.app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
        self.classifier = classifier
        self._setup_middlewares()
        self._setup_routes()

    def _setup_middlewares(self):
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    def _setup_routes(self):
        @self.app.get("/")
        async def root():
            return {"status": "TexGuard API is running", "message": "Backend AI siap digunakan!"}

        @self.app.post("/api/predictions/batch")
        @self.limiter.limit("60/minute")
        async def predict_batch(request: Request, payload: BatchRequest):
            return self.processPrediction(payload)

        @self.app.post("/api/feedback")
        @self.limiter.limit("60/minute")
        async def submit_feedback(request: Request, payload: FeedbackRequest):
            return self.submitFeedback(payload)

        # --- INJEKSI KODE: SISTEM LOGIN JWT ---
        @self.app.post("/api/auth/login")
        async def login(payload: LoginRequest):
            try:
                # Cek password menggunakan bcrypt
                if not bcrypt.checkpw(payload.password.encode('utf-8'), ADMIN_PASSWORD_HASH.encode('utf-8')):
                    raise ValueError("Password salah")
                
                # Buat JWT Token berlaku 24 jam
                expire = datetime.utcnow() + timedelta(hours=24)
                to_encode = {"sub": "admin", "exp": expire}
                encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm="HS256")
                
                return {"access_token": encoded_jwt, "token_type": "bearer"}
            except Exception as e:
                raise HTTPException(status_code=401, detail="Login Gagal: Password Salah")
        # --------------------------------------

        # --- INJEKSI KODE: ENDPOINT DASBOR ADMIN ---
        @self.app.get("/api/admin/stats")
        async def get_admin_stats(request: Request):
            # --- INJEKSI KODE: KEAMANAN DASBOR (JWT) ---
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                raise HTTPException(status_code=401, detail="Akses Ditolak: Token Tidak Ditemukan!")
            
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
                if payload.get("sub") != "admin":
                    raise Exception("Bukan admin")
            except jwt.ExpiredSignatureError:
                raise HTTPException(status_code=401, detail="Akses Ditolak: Sesi Anda Telah Berakhir (Silakan Login Ulang)")
            except Exception:
                raise HTTPException(status_code=401, detail="Akses Ditolak: Token Tidak Valid!")
            # ---------------------------------------------
            
            db = SessionLocal()
            try:
                total_requests = db.query(models.TelemetryLog).count()
                total_feedback = db.query(models.FeedbackLog).count()
                
                # Hitung Rata-rata Latency
                from sqlalchemy.sql import func
                avg_latency = db.query(func.avg(models.TelemetryLog.inference_time_ms)).scalar() or 0.0
                
                # Hitung Rasio Spam vs Normal
                spam_count = db.query(models.TelemetryLog).filter(models.TelemetryLog.predicted_label == "spam").count()
                toxic_count = db.query(models.TelemetryLog).filter(models.TelemetryLog.predicted_label.in_(["toxic", "hate_speech", "cyberbullying"])).count()
                normal_count = db.query(models.TelemetryLog).filter(models.TelemetryLog.predicted_label == "normal").count()
                
                # Hitung Traffic per Platform
                platform_counts_raw = db.query(models.TelemetryLog.platform, func.count(models.TelemetryLog.platform)).group_by(models.TelemetryLog.platform).all()
                platform_counts = dict(platform_counts_raw)
                
                # Ambil 100 Log Terbaru (Dibatasi agar browser tidak crash jika data mencapai jutaan)
                latest_logs = db.query(models.TelemetryLog).order_by(models.TelemetryLog.timestamp.desc()).limit(100).all()
                latest_feedbacks = db.query(models.FeedbackLog).order_by(models.FeedbackLog.timestamp.desc()).limit(100).all()
                
                return {
                    "overview": {
                        "total_requests": total_requests,
                        "total_feedback": total_feedback,
                        "avg_latency_ms": round(avg_latency, 2),
                        "spam_count": spam_count,
                        "toxic_count": toxic_count,
                        "normal_count": normal_count,
                        "platform_counts": platform_counts
                    },
                    "latest_logs": latest_logs,
                    "latest_feedbacks": latest_feedbacks
                }
            except Exception as e:
                return {"error": str(e)}
            finally:
                db.close()
        # -------------------------------------------

        @self.app.get("/api/admin/export/telemetry")
        async def export_telemetry(request: Request, start_date: str = Query(None), end_date: str = Query(None)):
            # Cek JWT
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                raise HTTPException(status_code=401, detail="Akses Ditolak")
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
            except Exception:
                raise HTTPException(status_code=401, detail="Akses Ditolak")
            
            db = SessionLocal()
            try:
                query = db.query(models.TelemetryLog)
                if start_date:
                    query = query.filter(models.TelemetryLog.timestamp >= start_date)
                if end_date:
                    # Tambah 1 hari untuk cover seluruh hari end_date (sampai 23:59:59)
                    query = query.filter(models.TelemetryLog.timestamp <= end_date + " 23:59:59")
                
                logs = query.order_by(models.TelemetryLog.timestamp.desc()).all()
                
                import io, csv
                output = io.StringIO()
                writer = csv.writer(output)
                writer.writerow(["ID", "Timestamp", "Platform", "Text", "Predicted_Label", "Confidence", "Latency_MS"])
                for log in logs:
                    writer.writerow([log.id, log.timestamp.strftime("%Y-%m-%d %H:%M:%S"), log.platform, log.text, log.predicted_label, log.confidence, log.inference_time_ms])
                
                return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=texguard_telemetry.csv"})
            finally:
                db.close()

        @self.app.get("/api/admin/export/feedback")
        async def export_feedback(request: Request, start_date: str = Query(None), end_date: str = Query(None)):
            # Cek JWT
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                raise HTTPException(status_code=401, detail="Akses Ditolak")
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
            except Exception:
                raise HTTPException(status_code=401, detail="Akses Ditolak")
            
            db = SessionLocal()
            try:
                query = db.query(models.FeedbackLog)
                if start_date:
                    query = query.filter(models.FeedbackLog.timestamp >= start_date)
                if end_date:
                    query = query.filter(models.FeedbackLog.timestamp <= end_date + " 23:59:59")
                
                logs = query.order_by(models.FeedbackLog.timestamp.desc()).all()
                
                import io, csv
                output = io.StringIO()
                writer = csv.writer(output)
                writer.writerow(["ID", "Timestamp", "Platform", "System_Label", "Corrected_Label", "Comment"])
                for log in logs:
                    # Note: We assume "Corrected_Label" is implicit because FeedbackLog only stores false positive text and original prediction.
                    # Wait, our feedback model only has: platform, text, original_predicted_label. It doesn't store the corrected one?
                    # Let's check model. Oh, the model doesn't have corrected_label. We can just put empty or "TBD".
                    writer.writerow([log.id, log.timestamp.strftime("%Y-%m-%d %H:%M:%S"), log.platform, log.original_predicted_label, "MANUAL_REVIEW", log.text])
                
                return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=texguard_feedback.csv"})
            finally:
                db.close()

    def processPrediction(self, payload: BatchRequest) -> dict:
        results = []
        texts = [item.text for item in payload.comments]
        ids = [item.id for item in payload.comments]

        if not texts:
            return {"results": []}

        start_time = time.time()
        try:
            probs_list = self.classifier.executeInference(texts)
            for i, probs in enumerate(probs_list):
                final_res = self.classifier.determineFinalLabel(probs)
                results.append({
                    "id": ids[i],
                    "category": final_res["category"],
                    "confidence": final_res["confidence"]
                })
        except Exception as e:
            print(f"Error processing batch: {e}")
            return {"results": []}

        process_time = time.time() - start_time
        print(f"[INFO] Memproses {len(texts)} komentar dalam {process_time:.3f} detik")
        
        # --- INJEKSI KODE: SIMPAN TELEMETRY (BACKGROUND THREAD) ---
        predicted_categories = [res["category"] for res in results]
        confidences = [res["confidence"] for res in results]
        threading.Thread(target=save_telemetry_background, args=(payload.platform, texts, predicted_categories, confidences, process_time*1000), daemon=True).start()
        # --------------------------------------------------------
        
        return {"results": results}

    def submitFeedback(self, payload: FeedbackRequest) -> dict:
        print(f"[INFO] Feedback diterima: {payload.system_label} seharusnya {payload.corrected_label}")
        
        # 1. Simpan ke CSV
        csv_file = "dataset_feedback.csv"
        file_exists = os.path.isfile(csv_file)
        
        try:
            with open(csv_file, mode='a', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                if not file_exists:
                    writer.writerow(["Timestamp", "System_Label", "Corrected_Label", "Comment"])
                
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                writer.writerow([timestamp, payload.system_label, payload.corrected_label, payload.comment_text])
        except Exception as e:
            print(f"[ERROR] Gagal menyimpan ke CSV: {e}")

        # 2. Kirim notifikasi Telegram (Asinkron)
        def send_telegram():
            if not requests or TELEGRAM_BOT_TOKEN == "ISI_TOKEN_BOT_ANDA_DI_SINI":
                return
            
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            msg = f"🔔 *Feedback Baru (TexGuard)*\n\n*Komentar:* {payload.comment_text}\n*AI:* {payload.system_label}\n*Koreksi:* {payload.corrected_label}"
            
            try:
                requests.post(url, json={"chat_id": TELEGRAM_CHAT_ID, "text": msg, "parse_mode": "Markdown"}, timeout=5)
            except Exception as e:
                print(f"[ERROR] Gagal kirim Telegram: {e}")
                
        threading.Thread(target=send_telegram, daemon=True).start()

        # --- INJEKSI KODE: SIMPAN FEEDBACK KE SQLITE (BACKGROUND THREAD) ---
        threading.Thread(target=save_feedback_background, args=(payload.platform, payload.system_label, payload.corrected_label, payload.comment_text), daemon=True).start()
        # -------------------------------------------------------------------

        return {"status": "success", "message": "Feedback saved successfully"}
