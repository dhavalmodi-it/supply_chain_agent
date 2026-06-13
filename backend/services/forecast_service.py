"""
forecast_service.py — Enhanced version
Adds new features to XGBoost: weekend, holiday, black_friday,
bulk_order, uncertainty, seasonality signals.
UPDATED: Uses current (last day) stock + adds stockout risk calculation
Output format is backward compatible — frontend unchanged.
"""
import pandas as pd
import numpy as np

from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor

SEQ_LEN = 7

# ─── Indian Holidays 2025 + 2026 ─────────────────────────
# Used when building features for future forecast dates
INDIAN_HOLIDAYS = {
    "2025-01-01","2025-01-14","2025-01-26","2025-03-17",
    "2025-04-14","2025-04-18","2025-05-01","2025-08-15",
    "2025-08-27","2025-10-02","2025-10-20","2025-10-21",
    "2025-10-22","2025-11-05","2025-12-25",
    "2026-01-01","2026-01-26","2026-08-15","2026-10-02",
    "2026-10-19","2026-12-25",
}

BLACK_FRIDAYS = {"2025-11-28","2026-11-27"}


def is_bulk_order_day(date):
    return int(date.weekday() == 0 and
               (date.day <= 5 or
                (date.month in [1,4,7,10] and date.day <= 7)))


# ─── Build extra features for a single date ──────────────
def date_features(date, category=""):
    """Returns dict of all new feature values for a given date."""
    ds  = str(date.date())
    dow = date.weekday()

    is_weekend      = int(dow >= 5)
    is_holiday      = int(ds in INDIAN_HOLIDAYS)
    is_black_friday = int(ds in BLACK_FRIDAYS)
    is_bulk         = is_bulk_order_day(date)

    # Day after holiday recovery
    prev_ds = str((date - pd.Timedelta(days=1)).date())
    post_holiday = int(prev_ds in INDIAN_HOLIDAYS)

    # Diwali season (Oct 15 – Nov 5)
    diwali_season = int(
        pd.Timestamp("2025-10-15") <= date <= pd.Timestamp("2025-11-05") or
        pd.Timestamp("2026-10-03") <= date <= pd.Timestamp("2026-11-05")
    )

    # Monthly seasonality index (0.0–1.0, peaks in Oct-Dec)
    monthly_idx = [0.7,0.7,0.8,0.8,0.85,0.85,0.8,0.85,0.9,1.0,1.0,0.95]
    season_idx  = monthly_idx[date.month - 1]

    # Day of week index (Mon=0 highest, Sun=6 lowest)
    dow_idx = [1.0,0.95,0.95,0.9,1.05,0.6,0.5][dow]

    # Black Friday pre-week signal
    days_to_bf = min(
        abs((date - pd.Timestamp(bf)).days)
        for bf in [pd.Timestamp("2025-11-28"), pd.Timestamp("2026-11-27")]
    )
    pre_bf_signal = max(0, 1 - days_to_bf / 7) if days_to_bf <= 7 else 0

    return {
        "is_weekend":      is_weekend,
        "is_holiday":      is_holiday,
        "is_black_friday": is_black_friday,
        "is_bulk_order":   is_bulk,
        "post_holiday":    post_holiday,
        "diwali_season":   diwali_season,
        "season_idx":      season_idx,
        "dow_idx":         dow_idx,
        "pre_bf_signal":   pre_bf_signal,
    }


# ─── Time-series sequences with new features ─────────────
def create_sequences(sales_norm, feature_df, seq_len):
    """
    Each sample = seq_len days of [scaled_sales + 9 extra features]
    Target = next day's scaled sales
    """
    extra_cols = [
        "is_weekend","is_holiday","is_black_friday","is_bulk_order",
        "post_holiday","diwali_season","season_idx","dow_idx","pre_bf_signal"
    ]
    extra = feature_df[extra_cols].values
    n     = len(sales_norm)
    X, y  = [], []

    for i in range(n - seq_len):
        # window: [scaled_sale, feat1, feat2, ...] for each day
        window = np.hstack([
            sales_norm[i:i+seq_len],           # shape (7,1)
            extra[i:i+seq_len]                  # shape (7,9)
        ])
        X.append(window.flatten())              # 7 × 10 = 70 features
        y.append(sales_norm[i+seq_len][0])

    return np.array(X), np.array(y)


def calculate_mape(y_true, y_pred):
    return np.mean(np.abs((y_true - y_pred) / (y_true + 1e-5))) * 100


# ─── MAIN ─────────────────────────────────────────────────
def train_model():
    df = pd.read_csv("backend/data/sales_data.csv", parse_dates=["date"])

    # Check if new columns exist (backward compatible)
    new_cols = ["is_weekend","is_holiday","is_black_friday",
                "is_bulk_order","uncertainty"]
    has_new  = all(c in df.columns for c in new_cols)

    if not has_new:
        print("WARNING: New columns not found. Run generate_data.py first.")
        print("Falling back to sales-only features.")

    results   = {}
    forecasts = {}

    for product in df["product_id"].unique():
        pdf = df[df["product_id"] == product].copy().reset_index(drop=True)

        product_name = pdf["product_name"].iloc[0]
        category     = pdf["category"].iloc[0]
        
        # ─── USE CURRENT (LAST DAY) STOCK ────────────────────
        stock = int(pdf["current_stock"].iloc[-1])
        avg_daily_sales = float(pdf["sales"].mean())

        # ── Build date-based feature columns ──
        pdf["post_holiday"]  = pdf["date"].apply(
            lambda d: int(str((d - pd.Timedelta(days=1)).date()) in INDIAN_HOLIDAYS)
        )
        pdf["diwali_season"] = pdf["date"].apply(
            lambda d: int(pd.Timestamp("2025-10-15") <= d <= pd.Timestamp("2025-11-05"))
        )
        pdf["season_idx"]    = pdf["date"].dt.month.map(
            lambda m: [0.7,0.7,0.8,0.8,0.85,0.85,0.8,0.85,0.9,1.0,1.0,0.95][m-1]
        )
        pdf["dow_idx"]       = pdf["date"].dt.dayofweek.map(
            lambda d: [1.0,0.95,0.95,0.9,1.05,0.6,0.5][d]
        )
        pdf["pre_bf_signal"] = pdf["date"].apply(
            lambda d: max(0, 1 - abs((d - pd.Timestamp("2025-11-28")).days) / 7)
            if abs((d - pd.Timestamp("2025-11-28")).days) <= 7 else 0
        )

        # Use new cols if available, else zeros
        if not has_new:
            for c in ["is_weekend","is_holiday","is_black_friday","is_bulk_order"]:
                pdf[c] = 0

        # ── Scale sales ──
        values = pdf["sales"].values.reshape(-1, 1)
        scaler = MinMaxScaler()
        scaled = scaler.fit_transform(values)

        # ── Create sequences with all features ──
        X, y = create_sequences(scaled, pdf, SEQ_LEN)

        if len(X) < 10:
            continue

        # ── Train / test split ──
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, shuffle=False
        )

        # ── XGBoost (same hyperparams as original) ──
        model = XGBRegressor(
            n_estimators=300,
            learning_rate=0.05,
            max_depth=6,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42
        )
        model.fit(X_train, y_train)

        # ── Evaluate ──
        pred_test  = model.predict(X_test)
        y_actual   = scaler.inverse_transform(y_test.reshape(-1,1))
        pred_actual= scaler.inverse_transform(pred_test.reshape(-1,1))

        mae      = float(mean_absolute_error(y_actual, pred_actual))
        mape     = float(calculate_mape(y_actual, pred_actual))
        accuracy = float(max(0, 100 - mape))
        try:
            r2 = float(r2_score(y_actual, pred_actual))
        except:
            r2 = -1.0

        # ── Future forecast — autoregressive with real future features ──
        last_seq   = scaled[-SEQ_LEN:].copy()
        last_date  = pdf["date"].iloc[-1]
        future_vals = []
        current_seq = last_seq.copy()

        # Pre-build extra features for next 30 days
        future_dates   = [last_date + pd.Timedelta(days=i+1) for i in range(30)]
        future_feats   = pd.DataFrame([date_features(d, category) for d in future_dates])

        for i in range(30):
            feat_row = future_feats.iloc[i:i+1]
            # Build window: last SEQ_LEN scaled sales + SEQ_LEN rows of features
            # Simplification: repeat the future feature for the whole window
            feat_window = np.tile(
                feat_row[["is_weekend","is_holiday","is_black_friday",
                           "is_bulk_order","post_holiday","diwali_season",
                           "season_idx","dow_idx","pre_bf_signal"]].values,
                (SEQ_LEN, 1)
            )
            window = np.hstack([current_seq, feat_window]).flatten()

            pred_next = model.predict([window])[0]
            future_vals.append(pred_next)
            current_seq = np.append(current_seq[1:], [[pred_next]], axis=0)

        future_inv = scaler.inverse_transform(
            np.array(future_vals).reshape(-1,1)
        ).flatten()

        forecasts[product] = future_inv.tolist()

        # ─── STOCKOUT RISK CALCULATION ──────────────────────────
        # Estimate days until stock depletion at current burn rate
        if avg_daily_sales > 0:
            days_until_stockout = int(stock / avg_daily_sales)
        else:
            days_until_stockout = 999
        
        # Risk classification
        if days_until_stockout < 7:
            stockout_status = "CRITICAL"
            stockout_rec = "Reorder immediately — risk of stockout in < 1 week"
        elif days_until_stockout < 14:
            stockout_status = "WARNING"
            stockout_rec = "Reorder soon — monitor stock levels closely"
        else:
            stockout_status = "OK"
            stockout_rec = "Stock levels adequate — continue monitoring"

        # ── Build interpretation (enhanced with stockout risk) ──
        r2_text = ("Model unstable due to demand variation"
                   if r2 < 0
                   else f"Model explains {r2*100:.1f}% of demand variation")

        # Count upcoming events in forecast window
        upcoming_holidays = sum(1 for d in future_dates
                                if str(d.date()) in INDIAN_HOLIDAYS)
        upcoming_bf       = any(str(d.date()) in BLACK_FRIDAYS
                                for d in future_dates)
        upcoming_bulk     = sum(1 for d in future_dates if is_bulk_order_day(d))

        interpretation = {
            "accuracy": f"Model accuracy: {accuracy:.1f}%",
            "mae":      f"Average error: {mae:.1f} units",
            "mape":     f"Error rate: {mape:.1f}%",
            "r2":       r2_text,
            # ── Supply Chain Signals ──
            "events": {
                "holidays_in_forecast":   upcoming_holidays,
                "black_friday_in_window": upcoming_bf,
                "bulk_order_days":        upcoming_bulk,
                "features_used": [
                    "sales_history","weekend_pattern",
                    "public_holidays","black_friday",
                    "bulk_orders","diwali_season",
                    "day_of_week","monthly_seasonality"
                ]
            },
            # ── STOCKOUT RISK ──
            "stockout_risk": {
                "current_stock":      stock,
                "avg_daily_sales":    round(avg_daily_sales, 1),
                "days_until_stockout": days_until_stockout,
                "status":             stockout_status,
                "recommendation":     stockout_rec
            }
        }

        results[product] = {
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
            "interpretation": interpretation
        }

    return {
        "objective": "Increase agility, resilience, and efficiency across supply chain using AI-driven forecasting and intelligent decision-making",
        "products":  list(results.values()),
        "forecasts": forecasts
    }
