"""
evaluate_model.py
==================
Loads the saved model + a freshly generated (different-seed) synthetic
test set, and reports MAE / RMSE / R^2. Used to sanity-check that the
saved model generalizes beyond the exact training draw.

Usage:
    python evaluate_model.py --rows 2000 --seed 999
"""
import argparse
import json
import os
import sys

import joblib
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data.generate_dataset import generate_dataset, FEATURE_COLUMNS, TARGET_COLUMN  # noqa: E402

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(os.path.dirname(THIS_DIR), "models")


def evaluate(n_rows: int, seed: int):
    model_path = os.path.join(MODELS_DIR, "delay_model.joblib")
    if not os.path.exists(model_path):
        raise FileNotFoundError("No trained model found. Run train_model.py first.")

    model = joblib.load(model_path)
    df = generate_dataset(n_rows, seed)
    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]

    preds = model.predict(X)
    mae = mean_absolute_error(y, preds)
    rmse = float(np.sqrt(mean_squared_error(y, preds)))
    r2 = r2_score(y, preds)

    result = {
        "holdout_rows": n_rows,
        "holdout_seed": seed,
        "MAE_minutes": round(float(mae), 4),
        "RMSE_minutes": round(float(rmse), 4),
        "R2": round(float(r2), 4),
    }
    print(json.dumps(result, indent=2))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", type=int, default=2000)
    parser.add_argument("--seed", type=int, default=999)
    args = parser.parse_args()
    evaluate(args.rows, args.seed)
