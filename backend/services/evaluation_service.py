from sklearn.metrics import mean_absolute_error, r2_score
import numpy as np

def calculate_metrics(y_true, y_pred):
    mae = mean_absolute_error(y_true, y_pred)
    mape = np.mean(np.abs((y_true - y_pred)/y_true))*100
    accuracy = 100 - mape
    r2 = r2_score(y_true, y_pred)

    return mae, mape, accuracy, r2


def format_interpretation(mae, mape, accuracy, r2):
    return {
        "accuracy": f"Model is {accuracy:.1f}% accurate on unseen data",
        "mae": f"Average daily error: {mae:.1f} units",
        "mape": f"Average % error: {mape:.1f}%",
        "r2": f"Model explains {r2 * 100:.1f}% of demand variation"
    }