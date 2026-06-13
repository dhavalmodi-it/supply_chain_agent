"""
generate_data.py — Enhanced version
Adds: holidays, weekends, Black Friday, bulk orders, uncertainty
All new columns are backward-compatible — existing frontend unchanged
UPDATED: current_stock now varies per day (inventory depletion model)
"""
import pandas as pd
import numpy as np

np.random.seed(42)

days  = 365
dates = pd.date_range(start="2025-01-01", periods=days)

# ─── Indian Public Holidays 2025 ─────────────────────────
# Sales DROP on these days (stores closed / logistics halt)
INDIAN_HOLIDAYS = {
    "2025-01-01": "New Year",
    "2025-01-14": "Makar Sankranti",
    "2025-01-26": "Republic Day",
    "2025-03-17": "Holi",
    "2025-04-14": "Ambedkar Jayanti",
    "2025-04-18": "Good Friday",
    "2025-05-01": "Labour Day",
    "2025-08-15": "Independence Day",
    "2025-08-27": "Janmashtami",
    "2025-10-02": "Gandhi Jayanti",
    "2025-10-02": "Dussehra",
    "2025-10-20": "Diwali",
    "2025-10-21": "Diwali",
    "2025-10-22": "Diwali",
    "2025-11-05": "Guru Nanak Jayanti",
    "2025-12-25": "Christmas",
}

# ─── Black Friday — last Friday of November ──────────────
BLACK_FRIDAY = "2025-11-28"

# ─── Helper: detect bulk/EBU order days ──────────────────
# EBU = Enterprise/B2B customers — typically order on
# Monday mornings at start of month or quarter
def is_bulk_order_day(date):
    is_monday      = date.weekday() == 0
    is_month_start = date.day <= 5
    is_qtr_start   = date.month in [1, 4, 7, 10] and date.day <= 7
    return int(is_monday and (is_month_start or is_qtr_start))

# ─── Products (same as original) ─────────────────────────
products = [
    {"id": "P1", "name": "iPhone 14",     "category": "Electronics", "pattern": "high"},
    {"id": "P2", "name": "Wheat Flour",   "category": "Grocery",     "pattern": "low"},
    {"id": "P3", "name": "T-Shirt",       "category": "Clothing",    "pattern": "stable"},
    {"id": "P4", "name": "Pain Reliever", "category": "Pharma",      "pattern": "growing"},
    {"id": "P5", "name": "Office Chair",  "category": "Furniture",   "pattern": "balanced"},
]

all_data = []

for p in products:
    base = 200

    # ── Same trend logic as original ──
    if p["pattern"] == "high":
        trend = np.linspace(50, 150, days)
        noise = np.random.normal(0, 3, days)
    elif p["pattern"] == "low":
        trend = np.linspace(-50, -20, days)
        noise = np.random.normal(0, 3, days)
    elif p["pattern"] == "stable":
        trend = np.zeros(days)
        noise = np.random.normal(0, 3, days)
    elif p["pattern"] == "growing":
        trend = np.linspace(20, 80, days)
        noise = np.random.normal(0, 3, days)
    elif p["pattern"] == "balanced":
        trend = np.linspace(-10, 10, days)
        noise = np.random.normal(0, 3, days)

    seasonality = 20 * np.sin(np.arange(days) * 2 * np.pi / 7)

    # ── Base sales (same as original) ──
    sales = base + trend + seasonality + noise

    # ── NEW: Apply real-world modifiers day by day ──
    is_weekend_arr      = []
    is_holiday_arr      = []
    is_black_friday_arr = []
    is_bulk_order_arr   = []
    holiday_name_arr    = []
    uncertainty_arr     = []
    current_stock_arr   = []

    for i, date in enumerate(dates):
        date_str   = str(date.date())
        dow        = date.weekday()

        # Weekend — sales drop 30-40%
        weekend = int(dow >= 5)
        if weekend:
            sales[i] *= np.random.uniform(0.60, 0.70)

        # Holiday — sales drop 50-70% (logistics halt)
        holiday    = int(date_str in INDIAN_HOLIDAYS)
        hol_name   = INDIAN_HOLIDAYS.get(date_str, "")
        if holiday:
            sales[i] *= np.random.uniform(0.30, 0.50)

        # Day AFTER holiday — recovery spike +20%
        prev_date = str((date - pd.Timedelta(days=1)).date())
        if prev_date in INDIAN_HOLIDAYS:
            sales[i] *= 1.20

        # Black Friday — massive spike +120% (electronics/clothing esp.)
        black_fri  = int(date_str == BLACK_FRIDAY)
        if black_fri:
            multiplier = 2.2 if p["category"] in ["Electronics","Clothing"] else 1.5
            sales[i]  *= multiplier

        # Week before Black Friday — pre-stocking spike
        days_to_bf = (pd.Timestamp(BLACK_FRIDAY) - date).days
        if 1 <= days_to_bf <= 7:
            sales[i] *= 1.10

        # Bulk/EBU order day — spike +40-60% for B2B products
        bulk = is_bulk_order_day(date)
        if bulk and p["category"] in ["Electronics","Furniture","Pharma"]:
            sales[i] *= np.random.uniform(1.40, 1.60)

        # Diwali season boost (Oct 15 - Nov 5) for electronics/clothing
        if p["category"] in ["Electronics","Clothing"]:
            diwali_start = pd.Timestamp("2025-10-15")
            diwali_end   = pd.Timestamp("2025-11-05")
            if diwali_start <= date <= diwali_end:
                sales[i] *= np.random.uniform(1.20, 1.40)

        is_weekend_arr.append(weekend)
        is_holiday_arr.append(holiday)
        is_black_friday_arr.append(black_fri)
        is_bulk_order_arr.append(bulk)
        holiday_name_arr.append(hol_name)

    # ─── DYNAMIC INVENTORY MODEL ────────────────────────────
    # Track running stock: depletes with sales, replenishes on signal
    running_stock = np.random.randint(150, 400)
    REORDER_POINT = 50      # when to trigger replenishment
    RESTOCK_QTY = np.random.randint(200, 400)  # order quantity per product

    for i, daily_sales in enumerate(sales):
        # Record stock level at START of day
        current_stock_arr.append(max(0, int(running_stock)))
        
        # Depletion: subtract sales
        running_stock -= daily_sales
        
        # Replenishment logic: if stock drops below reorder point, restock
        if running_stock < REORDER_POINT:
            restock_qty = np.random.randint(200, 400)
            running_stock += restock_qty
        
        # Floor at zero (can't have negative stock in real system)
        running_stock = max(0, running_stock)

    # Uncertainty score — rolling 7-day volatility (std / mean)
    sales_series = pd.Series(sales)
    roll_std     = sales_series.rolling(7, min_periods=1).std().fillna(0)
    roll_mean    = sales_series.rolling(7, min_periods=1).mean().fillna(1)
    uncertainty  = (roll_std / (roll_mean + 1e-5)).clip(0, 1)

    df = pd.DataFrame({
        "date":            dates,
        "product_id":      p["id"],
        "product_name":    p["name"],
        "category":        p["category"],
        "sales":           sales.astype(int),
        "current_stock":   current_stock_arr,  # ← NOW VARIES BY DAY
        # ── NEW COLUMNS ──
        "is_weekend":      is_weekend_arr,
        "is_holiday":      is_holiday_arr,
        "holiday_name":    holiday_name_arr,
        "is_black_friday": is_black_friday_arr,
        "is_bulk_order":   is_bulk_order_arr,
        "uncertainty":     uncertainty.round(4),
    })

    all_data.append(df)

final_df = pd.concat(all_data)
final_df.to_csv("backend/data/sales_data.csv", index=False)

# ── Summary report ──
print("Enhanced data generated successfully!")
print(f"Total rows     : {len(final_df)}")
print(f"Columns        : {list(final_df.columns)}")
print(f"Holiday days   : {final_df['is_holiday'].sum() // len(products)}")
print(f"Weekend days   : {final_df['is_weekend'].sum() // len(products)}")
print(f"Black Friday   : {final_df['is_black_friday'].sum() // len(products)} day")
print(f"Bulk order days: {final_df['is_bulk_order'].sum() // len(products)}")
print(f"\nInventory now varies per day (depletion + replenishment model)")
print(f"Stock range    : {final_df['current_stock'].min()} to {final_df['current_stock'].max()} units")
