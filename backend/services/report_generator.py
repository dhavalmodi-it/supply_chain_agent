# backend/services/report_generator.py

from datetime import datetime
import json

def generate_recommendation(avg):
    if avg > 230:
        return "Increase stock levels"
    elif avg < 180:
        return "Reduce stock"
    return "Maintain inventory"


def generate_report(metrics, forecast):
    avg = sum(forecast)/len(forecast)

    report = {
        "timestamp": str(datetime.now()),
        "metrics": metrics,
        "forecast_summary": {
            "average": avg,
            "max": max(forecast),
            "min": min(forecast)
        },
        "recommendation": generate_recommendation(avg)
    }

    with open("backend/report.json", "w") as f:
        json.dump(report, f, indent=4)

    return report