import uvicorn
from app.services.classifier import IndoBERTweetClassifier
from app.controllers.fastapi_controller import FastAPIController
from app.database import models
from app.database.db import engine

# Create SQLite database tables if they don't exist
models.Base.metadata.create_all(bind=engine)

# Initialize the classifier and load the model
classifier = IndoBERTweetClassifier(model_path="./models")
classifier.loadModel()

# Initialize the FastAPI controller
controller = FastAPIController(classifier)

# Expose the app object for ASGI servers (like uvicorn)
app = controller.app

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)