"""
forecast_service.py — Enhanced (non-breaking)
Now uses 15 features per time step instead of 1.
Output format is IDENTICAL to original — all frontend code works unchanged.
"""
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor

SEQ_LEN = 7

INDIAN_HOLIDAYS = {
    "2025-01-01","2025-01-14","2025-01-26","2025-03-17",
    "2025-04-14","2025-04-18","2025-05-01","2025-08-15",
    "2025-08-27","2025-10-02","2025-10-20","2025-10-21",
    "2025-10-22","2025-11-05","2025-12-25",
}

EXTRA_COLS = [
    "is_weekend","is_holiday","is_black_friday","is_diwali_season",
    "is_bulk_order","supplier_disruption","disruption_severity",
    "demand_spike","competitor_stockout","price_event",
    "lead_time_days","supply_available","uncertainty",
]

def calculate_mape(y_true, y_pred):
    return np.mean(np.abs((y_true - y_pred) / (y_true + 1e-5))) * 100


def create_sequences(sales_norm, extra_df, seq_len):
    """Each sample = seq_len days × (1 sales + N extra features)"""
    n       = len(sales_norm)
    extra   = extra_df.values
    X, y    = [], []
    for i in range(n - seq_len):
        window = np.hstack([
            sales_norm[i:i+seq_len],
            extra[i:i+seq_len]
        ])
        X.append(window.flatten())
        y.append(sales_norm[i+seq_len][0])
    return np.array(X), np.array(y)


def train_model(horizon=30):
    df = pd.read_csv("backend/data/sales_data.csv", parse_dates=["date"])

    # Check if enhanced columns exist
    has_extra = all(c in df.columns for c in EXTRA_COLS)
    if not has_extra:
        print("WARNING: Enhanced columns not found. Run generate_data.py first.")

    results   = []
    forecasts = {}
    
    stock_df = pd.read_csv("backend/data/current_stock.csv")
    stock_map = dict(zip(stock_df["product_id"], stock_df["current_stock"]))

    for product in df["product_id"].unique():
        pdf = df[df["product_id"] == product].copy().reset_index(drop=True)

        product_name = pdf["product_name"].iloc[0]
        category     = pdf["category"].iloc[0]
        # stock        = int(pdf["current_stock"].iloc[0])
        stock = stock_map.get(product, 0)

        values = pdf["sales"].values.reshape(-1, 1)
        scaler = MinMaxScaler()
        scaled = scaler.fit_transform(values)

        if has_extra:
            # Normalise continuous extra columns
            extra_df = pdf[EXTRA_COLS].copy().astype(float)
            for col in ["lead_time_days","disruption_severity","supply_available","uncertainty"]:
                mn, mx = extra_df[col].min(), extra_df[col].max()
                extra_df[col] = (extra_df[col] - mn) / (mx - mn + 1e-8)
            X, y = create_sequences(scaled, extra_df, SEQ_LEN)
        else:
            # Fallback — original behaviour
            from sklearn.preprocessing import MinMaxScaler as MMS
            X, y = [], []
            for i in range(len(scaled) - SEQ_LEN):
                X.append(scaled[i:i+SEQ_LEN].flatten())
                y.append(scaled[i+SEQ_LEN][0])
            X, y = np.array(X), np.array(y)

        if len(X) < 10:
            continue

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, shuffle=False
        )

        model = XGBRegressor(
            n_estimators=300, learning_rate=0.05, max_depth=6,
            subsample=0.8, colsample_bytree=0.8, random_state=42
        )
        model.fit(X_train, y_train)

        pred       = model.predict(X_test)
        y_actual   = scaler.inverse_transform(y_test.reshape(-1,1))
        pred_actual= scaler.inverse_transform(pred.reshape(-1,1))

        mae      = float(mean_absolute_error(y_actual, pred_actual))
        mape     = float(calculate_mape(y_actual, pred_actual))
        accuracy = float(max(0, 100 - mape))
        try:    r2 = float(r2_score(y_actual, pred_actual))
        except: r2 = -1.0

        # ── Future forecast — autoregressive ──
        last_sales = scaled[-SEQ_LEN:].copy()
        future_vals = []
        current    = last_sales.copy()

        if has_extra:
            last_extra = extra_df.values[-SEQ_LEN:].copy()

        for step in range(horizon):
            if has_extra:
                window = np.hstack([current, last_extra]).flatten()
            else:
                window = current.flatten()
            p_next = model.predict([window])[0]
            future_vals.append(p_next)
            current = np.append(current[1:], [[p_next]], axis=0)
            if has_extra:
                # Roll extra features — repeat last row
                last_extra = np.append(last_extra[1:], [last_extra[-1]], axis=0)

        future_inv = scaler.inverse_transform(
            np.array(future_vals).reshape(-1,1)
        ).flatten()
        forecasts[product] = future_inv.tolist()

        # ── Upcoming event context ──
        last_date     = pdf["date"].iloc[-1]
        future_dates  = [last_date + pd.Timedelta(days=i+1) for i in range(30)]
        upcoming_hols = sum(1 for d in future_dates if str(d.date()) in INDIAN_HOLIDAYS)
        upcoming_bf   = any(str(d.date()) == "2025-11-28" for d in future_dates)
        upcoming_bulk = sum(1 for d in future_dates
                            if d.weekday()==0 and (d.day<=5 or (d.month in [1,4,7,10] and d.day<=7)))

        sup_risk = ""
        if has_extra:
            dis_days = int(pdf["supplier_disruption"].sum())
            if dis_days > 0:
                sup_risk = f"Supplier disrupted {dis_days} days in history. "
            avg_supply = float(pdf["supply_available"].mean())
            if avg_supply < 0.9:
                sup_risk += f"Avg supply availability: {int(avg_supply*100)}%."

        r2_text = ("Model unstable due to demand variation"
                   if r2 < 0
                   else f"Model explains {r2*100:.1f}% of demand variation")

        interpretation = {
            "accuracy": f"Model accuracy: {accuracy:.1f}%",
            "mae":      f"Average error: {mae:.1f} units",
            "mape":     f"Error rate: {mape:.1f}%",
            "r2":       r2_text,
            "events": {
                "holidays_in_forecast":   upcoming_hols,
                "black_friday_in_window": upcoming_bf,
                "bulk_order_days":        upcoming_bulk,
                "supplier_risk":          sup_risk,
                "features_used": EXTRA_COLS if has_extra else ["sales_history"],
            }
        }

        results.append({
            "product":       product,
            "product_name":  product_name,
            "category":      category,
            "current_stock": stock,
            "metrics": {
                "MAE":      mae,
                "MAPE":     mape,
                "Accuracy": accuracy,
                "R2":       r2,
            },
            "interpretation": interpretation,
        })

    return {
        "objective": "Increase agility, resilience, and efficiency across supply chain using AI-driven forecasting and intelligent decision-making",
        "products":  results,
        "forecasts": forecasts,
    }
