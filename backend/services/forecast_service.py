import pandas as pd
import numpy as np

from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

from xgboost import XGBRegressor

SEQ_LEN = 7


# CREATE TIME SERIES SEQUENCES
def create_sequences(data, seq_len):
    X, y = [], []

    for i in range(len(data) - seq_len):
        X.append(data[i:i + seq_len].flatten())
        y.append(data[i + seq_len][0])

    return np.array(X), np.array(y)


# SAFE MAPE
def calculate_mape(y_true, y_pred):
    return np.mean(np.abs((y_true - y_pred) / (y_true + 1e-5))) * 100


# MAIN FUNCTION
def train_model():

    df = pd.read_csv("backend/data/sales_data.csv")

    results = []
    forecasts = {}

    for product in df["product_id"].unique():

        pdf = df[df["product_id"] == product].copy().reset_index(drop=True)

        product_name = pdf["product_name"].iloc[0]
        category = pdf["category"].iloc[0]
        stock = int(pdf["current_stock"].iloc[0])

        values = pdf["sales"].values.reshape(-1, 1)

        # SCALING
        scaler = MinMaxScaler()
        scaled = scaler.fit_transform(values)

        # CREATE SEQUENCE DATA
        X, y = create_sequences(scaled, SEQ_LEN)

        if len(X) < 10:
            continue

        # TRAIN / TEST SPLIT (FIX OVERFITTING)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, shuffle=False
        )

        # XGBOOST MODEL
        model = XGBRegressor(
            n_estimators=300,
            learning_rate=0.05,
            max_depth=6,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42
        )

        model.fit(X_train, y_train)

        # TEST PREDICTION (IMPORTANT)
        pred = model.predict(X_test)

        # INVERSE SCALE
        y_actual = scaler.inverse_transform(y_test.reshape(-1, 1))
        pred_actual = scaler.inverse_transform(pred.reshape(-1, 1))

        # METRICS (REALISTIC NOW)
        mae = float(mean_absolute_error(y_actual, pred_actual))
        mape = float(calculate_mape(y_actual, pred_actual))

        try:
            r2 = float(r2_score(y_actual, pred_actual))
        except:
            r2 = -1.0

        accuracy = float(max(0, 100 - mape))

        # FUTURE FORECAST
        last_seq = scaled[-SEQ_LEN:].flatten()
        future = []
        current = last_seq.copy()

        for _ in range(30):
            pred_next = model.predict([current])[0]
            future.append(pred_next)
            current = np.append(current[1:], pred_next)

        future = scaler.inverse_transform(
            np.array(future).reshape(-1, 1)
        ).flatten()

        forecasts[product] = future.tolist()

        # CLEAN INTERPRETATION
        if r2 < 0:
            r2_text = "Model unstable due to demand variation"
        else:
            r2_text = f"Model explains {r2 * 100:.1f}% of demand variation"

        interpretation = {
            "accuracy": f"Model accuracy: {accuracy:.1f}%",
            "mae": f"Average error: {mae:.1f} units",
            "mape": f"Error rate: {mape:.1f}%",
            "r2": r2_text
        }

        # IMPORTANT: KEEP ORIGINAL FORMAT
        results.append({
            "product": product,
            "product_name": product_name,
            "category": category,
            "current_stock": stock,
            "metrics": {
                "MAE": mae,
                "MAPE": mape,
                "Accuracy": accuracy,
                "R2": r2
            },
            "interpretation": interpretation
        })

    return {
        "objective": "AI-based demand forecasting and supply optimization",
        "products": results,
        "forecasts": forecasts
    }