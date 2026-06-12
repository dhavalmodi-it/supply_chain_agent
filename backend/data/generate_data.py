import pandas as pd
import numpy as np

np.random.seed(42)

days = 365
dates = pd.date_range(start="2025-01-01", periods=days)

products = [
    {"id": "P1", "name": "iPhone 14", "category": "Electronics", "pattern": "high"},
    {"id": "P2", "name": "Wheat Flour", "category": "Grocery", "pattern": "low"},
    {"id": "P3", "name": "T-Shirt", "category": "Clothing", "pattern": "stable"},
    {"id": "P4", "name": "Pain Reliever", "category": "Pharma", "pattern": "growing"},
    {"id": "P5", "name": "Office Chair", "category": "Furniture", "pattern": "balanced"},
]

all_data = []

for p in products:

    base = 200

    if p["pattern"] == "high":
        # High demand → triggers Increase Inventory
        trend = np.linspace(50, 150, days)
        noise = np.random.normal(0, 3, days)  # reduce noise

    elif p["pattern"] == "low":
        # Very low demand → triggers Reduce Inventory
        trend = np.linspace(-50, -20, days)
        noise = np.random.normal(0, 3, days)

    elif p["pattern"] == "stable":
        # Stable → Maintain
        trend = np.zeros(days)
        noise = np.random.normal(0, 3, days)

    elif p["pattern"] == "growing":
        # Growing demand → Increase
        trend = np.linspace(20, 80, days)
        noise = np.random.normal(0, 3, days)

    elif p["pattern"] == "balanced":
        # Balanced → Maintain
        trend = np.linspace(-10, 10, days)
        noise = np.random.normal(0, 3, days)

    seasonality = 20 * np.sin(np.arange(days) * 2 * np.pi / 7)

    sales = base + trend + seasonality + noise
    current_stock = np.random.randint(150, 400)
    
    df = pd.DataFrame({
        "date": dates,
        "product_id": p["id"],
        "product_name": p["name"],
        "category": p["category"],
        "sales": sales.astype(int),
        "current_stock": current_stock
    })

    all_data.append(df)

final_df = pd.concat(all_data)
final_df.to_csv("backend/data/sales_data.csv", index=False)

print("Controlled data generated for all supply scenarios")