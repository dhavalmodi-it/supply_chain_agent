"""
app.py — Enhanced FastAPI backend
New endpoints: /disruptions, /optimize
Original /report endpoint unchanged — frontend works as before
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.services.forecast_service import train_model
from backend.services.disruption_service import detect_disruptions
from backend.services.optimization_service import optimize
import pandas as pd

app = FastAPI(title="Supply Chain AI Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = "backend/data/sales_data.csv"

@app.get("/")
def health():
    return {"status": "ok", "version": "2.0-enhanced"}

@app.get("/report")
def report():
    """Original endpoint — unchanged. All existing frontend code works."""
    try:
        return train_model()
    except Exception as e:
        return {"error": str(e)}

@app.get("/disruptions")
def disruptions():
    """
    NEW — Detects active disruptions, demand spikes, inventory risks.
    Returns structured alerts with recommended actions.
    """
    try:
        df = pd.read_csv(DATA_PATH, parse_dates=["date"])
        return detect_disruptions(df)
    except Exception as e:
        return {"error": str(e)}

@app.get("/optimize")
def optimize_inventory():
    """
    NEW — Inventory + logistics optimization.
    Returns EOQ, safety stock, reorder points, ABC class, actions.
    """
    try:
        result   = train_model()
        df       = pd.read_csv(DATA_PATH, parse_dates=["date"])
        forecasts = {
            p["product"]: result["forecasts"].get(p["product"], [])
            for p in result["products"]
        }
        return optimize(df, forecasts)
    except Exception as e:
        return {"error": str(e)}

@app.get("/full-report")
def full_report(horizon: int = 30):
    """
    NEW — Returns forecast + disruptions + optimization in one call.
    Used by the enhanced frontend dashboard.
    """
    try:
        df          = pd.read_csv(DATA_PATH, parse_dates=["date"])
        forecast    = train_model(horizon)
        disruption  = detect_disruptions(df)
        forecasts_map = {
            p["product"]: forecast["forecasts"].get(p["product"], [])
            for p in forecast["products"]
        }
        opt = optimize(df, forecasts_map)
        return {
            "forecast":    forecast,
            "disruptions": disruption,
            "optimization": opt,
        }
    except Exception as e:
        return {"error": str(e)}
