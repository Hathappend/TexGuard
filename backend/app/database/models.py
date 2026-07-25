from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime
from .db import Base

class TelemetryLog(Base):
    __tablename__ = "telemetry_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    platform = Column(String, index=True)
    text = Column(String)
    predicted_label = Column(String, index=True)
    confidence = Column(Float)
    inference_time_ms = Column(Float)

class FeedbackLog(Base):
    __tablename__ = "feedback_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    platform = Column(String, index=True)
    text = Column(String)
    original_predicted_label = Column(String)
