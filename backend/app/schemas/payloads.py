from pydantic import BaseModel
from typing import List

class CommentItem(BaseModel):
    id: str
    text: str
    category: str = "normal"
    confidence: float = 0.0

class BatchRequest(BaseModel):
    platform: str = "unknown"
    comments: List[CommentItem]

class FeedbackRequest(BaseModel):
    platform: str = "unknown"
    system_label: str
    corrected_label: str
    comment_text: str

class LoginRequest(BaseModel):
    password: str
