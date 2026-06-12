from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.services.forecast_service import train_model

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health():
    return {"status": "ok"}

@app.get("/report")
def report():
    try:
        result = train_model()
        return result
    except Exception as e:
        return {"error": str(e)}