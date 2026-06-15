"""
generate_data.py — Full real-world supply chain simulation
New factors added on top of existing output (backward compatible):
  - Holidays, weekends, Black Friday, Diwali
  - Supplier disruptions (delays, shortages, quality holds)
  - Uncertain demand spikes (viral trends, weather, news events)
  - Bulk/EBU enterprise orders
  - Competitor stockouts (demand shifts)
  - Price elasticity events (discounts, price hikes)
  - Lead time variability
"""
import pandas as pd
import numpy as np

np.random.seed(42)
days  = 365
dates = pd.date_range(start="2025-01-01", periods=days)

# ── Indian public holidays ────────────────────────────────
INDIAN_HOLIDAYS = {
    "2025-01-01","2025-01-14","2025-01-26","2025-03-17",
    "2025-04-14","2025-04-18","2025-05-01","2025-08-15",
    "2025-08-27","2025-10-02","2025-10-20","2025-10-21",
    "2025-10-22","2025-11-05","2025-12-25",
}
BLACK_FRIDAY  = "2025-11-28"
DIWALI_START  = pd.Timestamp("2025-10-15")
DIWALI_END    = pd.Timestamp("2025-11-05")

# ── Supplier disruption windows ───────────────────────────
# (start_day_index, end_day_index, severity 0-1, type)
DISRUPTIONS = [
    (45,  55,  0.6, "port_congestion"),       # Feb port delay
    (120, 128, 0.8, "supplier_quality_hold"), # May quality issue
    (200, 215, 0.5, "raw_material_shortage"), # Jul shortage
    (280, 290, 0.7, "logistics_strike"),       # Oct strike
    (340, 348, 0.4, "weather_disruption"),     # Dec weather
]

# ── Uncertain demand events ───────────────────────────────
# (day_index, multiplier, duration_days, reason)
DEMAND_SPIKES = [
    (30,  1.8, 3,  "viral_social_trend"),
    (95,  1.5, 4,  "competitor_stockout"),
    (180, 2.1, 2,  "news_event_demand"),
    (250, 1.6, 5,  "flash_sale"),
    (320, 1.9, 3,  "influencer_campaign"),
]

# ── EBU bulk order days ───────────────────────────────────
def is_bulk_order(date):
    return int(date.weekday() == 0 and
               (date.day <= 5 or
                (date.month in [1,4,7,10] and date.day <= 7)))

products = [
    {"id":"P1","name":"iPhone 14",     "category":"Electronics","pattern":"high"},
    {"id":"P2","name":"Wheat Flour",   "category":"Grocery",    "pattern":"low"},
    {"id":"P3","name":"T-Shirt",       "category":"Clothing",   "pattern":"stable"},
    {"id":"P4","name":"Pain Reliever", "category":"Pharma",     "pattern":"growing"},
    {"id":"P5","name":"Office Chair",  "category":"Furniture",  "pattern":"balanced"},
]

all_data = []

for p in products:
    base = 200

    if   p["pattern"] == "high":     trend = np.linspace(50,  150, days); noise = np.random.normal(0,3,days)
    elif p["pattern"] == "low":      trend = np.linspace(-50, -20, days); noise = np.random.normal(0,3,days)
    elif p["pattern"] == "stable":   trend = np.zeros(days);              noise = np.random.normal(0,3,days)
    elif p["pattern"] == "growing":  trend = np.linspace(20,  80,  days); noise = np.random.normal(0,3,days)
    elif p["pattern"] == "balanced": trend = np.linspace(-10, 10,  days); noise = np.random.normal(0,3,days)

    seasonality = 20 * np.sin(np.arange(days) * 2 * np.pi / 7)
    sales = base + trend + seasonality + noise

    # ── Per-day feature arrays ──
    is_weekend_arr      = []
    is_holiday_arr      = []
    holiday_name_arr    = []
    is_black_friday_arr = []
    is_diwali_arr       = []
    is_bulk_order_arr   = []
    supplier_disruption_arr = []
    disruption_type_arr = []
    disruption_severity_arr = []
    demand_spike_arr    = []
    demand_spike_reason_arr = []
    competitor_stockout_arr = []
    price_event_arr     = []
    lead_time_days_arr  = []
    supply_available_arr= []
    uncertainty_arr     = []

    for i, date in enumerate(dates):
        ds  = str(date.date())
        dow = date.weekday()

        # Weekend
        wknd = int(dow >= 5)
        if wknd: sales[i] *= np.random.uniform(0.60, 0.70)

        # Holiday
        hol = int(ds in INDIAN_HOLIDAYS)
        hn  = ds if hol else ""
        if hol: sales[i] *= np.random.uniform(0.30, 0.50)

        # Day after holiday — recovery
        prev = str((date - pd.Timedelta(days=1)).date())
        if prev in INDIAN_HOLIDAYS: sales[i] *= 1.20

        # Black Friday
        bf = int(ds == BLACK_FRIDAY)
        if bf:
            mult = 2.2 if p["category"] in ["Electronics","Clothing"] else 1.5
            sales[i] *= mult
        # Pre-BF week
        days_to_bf = (pd.Timestamp(BLACK_FRIDAY) - date).days
        if 1 <= days_to_bf <= 7: sales[i] *= 1.10

        # Diwali season
        diwali = int(DIWALI_START <= date <= DIWALI_END)
        if diwali and p["category"] in ["Electronics","Clothing"]:
            sales[i] *= np.random.uniform(1.20, 1.40)

        # Bulk/EBU
        bulk = is_bulk_order(date)
        if bulk and p["category"] in ["Electronics","Furniture","Pharma"]:
            sales[i] *= np.random.uniform(1.40, 1.60)

        # ── Supplier disruptions ──
        sup_dis   = 0
        dis_type  = ""
        dis_sev   = 0.0
        lead_time = 7  # baseline lead time days
        supply_ok = 1.0

        for (start, end, sev, dtype) in DISRUPTIONS:
            if start <= i <= end:
                sup_dis  = 1
                dis_type = dtype
                dis_sev  = sev
                # Disruption increases lead time
                lead_time = int(7 + sev * 14)
                # Reduces supply availability
                supply_ok = max(0.1, 1.0 - sev * np.random.uniform(0.5, 1.0))
                # Demand side: some disruptions cause panic buying
                if dtype in ["raw_material_shortage","logistics_strike"]:
                    if p["category"] in ["Grocery","Pharma"]:
                        sales[i] *= np.random.uniform(1.2, 1.5)
                break

        # Lead time variability (random ±2 days even without disruption)
        lead_time += np.random.randint(-2, 3)
        lead_time  = max(1, lead_time)

        # ── Uncertain demand spikes ──
        d_spike  = 0
        d_reason = ""
        comp_so  = 0

        for (day, mult, dur, reason) in DEMAND_SPIKES:
            if day <= i < day + dur:
                d_spike  = 1
                d_reason = reason
                if reason == "competitor_stockout":
                    comp_so = 1
                sales[i] *= mult
                break

        # ── Price events (discount/hike every ~60 days) ──
        price_event = int((i % 63 == 0) or (i % 63 == 1))
        if price_event and (i % 63 == 0):
            sales[i] *= 1.30  # discount day — demand up
        elif price_event:
            sales[i] *= 0.85  # post-discount correction

        # Collect
        is_weekend_arr.append(wknd)
        is_holiday_arr.append(hol)
        holiday_name_arr.append(hn)
        is_black_friday_arr.append(bf)
        is_diwali_arr.append(diwali)
        is_bulk_order_arr.append(bulk)
        supplier_disruption_arr.append(sup_dis)
        disruption_type_arr.append(dis_type)
        disruption_severity_arr.append(round(dis_sev, 2))
        demand_spike_arr.append(d_spike)
        demand_spike_reason_arr.append(d_reason)
        competitor_stockout_arr.append(comp_so)
        price_event_arr.append(price_event)
        lead_time_days_arr.append(lead_time)
        supply_available_arr.append(round(supply_ok, 2))

    # Uncertainty = rolling 7-day coefficient of variation
    s        = pd.Series(sales)
    roll_std = s.rolling(7, min_periods=1).std().fillna(0)
    roll_mu  = s.rolling(7, min_periods=1).mean().fillna(1)
    uncertainty = (roll_std / (roll_mu + 1e-5)).clip(0, 1).round(4)

    # current_stock = np.random.randint(150, 400)

    df = pd.DataFrame({
        "date":                 dates,
        "product_id":           p["id"],
        "product_name":         p["name"],
        "category":             p["category"],
        "sales":                sales.astype(int),
        # "current_stock":        current_stock,
        "is_weekend":           is_weekend_arr,
        "is_holiday":           is_holiday_arr,
        "holiday_name":         holiday_name_arr,
        "is_black_friday":      is_black_friday_arr,
        "is_diwali_season":     is_diwali_arr,
        "is_bulk_order":        is_bulk_order_arr,
        "supplier_disruption":  supplier_disruption_arr,
        "disruption_type":      disruption_type_arr,
        "disruption_severity":  disruption_severity_arr,
        "demand_spike":         demand_spike_arr,
        "demand_spike_reason":  demand_spike_reason_arr,
        "competitor_stockout":  competitor_stockout_arr,
        "price_event":          price_event_arr,
        "lead_time_days":       lead_time_days_arr,
        "supply_available":     supply_available_arr,
        "uncertainty":          uncertainty.tolist(),
    })
    all_data.append(df)

final = pd.concat(all_data)
final.to_csv("backend/data/sales_data.csv", index=False)
print(f"Generated {len(final)} rows with {len(final.columns)} columns")
print(f"Columns: {list(final.columns)}")
print(f"Disruption days : {final['supplier_disruption'].sum() // len(products)}")
print(f"Demand spike days: {final['demand_spike'].sum() // len(products)}")
print(f"Holiday days    : {final['is_holiday'].sum() // len(products)}")

# ✅ Generate current stock snapshot (latest day only)

stock_data = []

for p in products:
    pdf = final[final["product_id"] == p["id"]].copy()

    avg_demand = pdf["sales"].tail(7).mean()
    supply_factor = pdf["supply_available"].tail(7).mean()
    lead_time = pdf["lead_time_days"].tail(7).mean()

    stock = int(avg_demand * lead_time * supply_factor * np.random.uniform(0.8, 1.2))

    stock_data.append({
        "product_id": p["id"],
        "current_stock": max(stock, 0)
    })

stock_df = pd.DataFrame(stock_data)

stock_df.to_csv("backend/data/current_stock.csv", index=False)

print("✅ Generated current_stock snapshot")