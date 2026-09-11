import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import joblib
import pytest

from data.generate_dataset import FEATURE_COLUMNS
from features.feature_engineering import build_feature_vector, compute_congestion_index

MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "delay_model.joblib")


def test_feature_vector_has_all_required_columns():
    features = build_feature_vector({"train_type": "fast", "priority": 1})
    for col in FEATURE_COLUMNS:
        assert col in features


def test_congestion_index_bounded_0_1():
    for occ in [0.0, 0.5, 1.0]:
        for ahead in [0, 3, 10]:
            score = compute_congestion_index(occ, ahead, True)
            assert 0.0 <= score <= 1.0


@pytest.mark.skipif(not os.path.exists(MODEL_PATH), reason="Model not trained yet; run training/train_model.py")
def test_trained_model_predicts_nonnegative_delay():
    model = joblib.load(MODEL_PATH)
    features = build_feature_vector({
        "current_delay_min": 5, "train_type": "slow", "priority": 3,
        "current_speed_kmh": 30, "section_occupancy": 0.4, "trains_ahead": 1,
    })
    X = pd.DataFrame([[features[c] for c in FEATURE_COLUMNS]], columns=FEATURE_COLUMNS)
    pred = model.predict(X)[0]
    assert pred >= 0


@pytest.mark.skipif(not os.path.exists(MODEL_PATH), reason="Model not trained yet; run training/train_model.py")
def test_higher_current_delay_increases_prediction():
    model = joblib.load(MODEL_PATH)
    low = build_feature_vector({"current_delay_min": 1, "train_type": "fast", "priority": 2})
    high = build_feature_vector({"current_delay_min": 20, "train_type": "fast", "priority": 2})
    X_low = pd.DataFrame([[low[c] for c in FEATURE_COLUMNS]], columns=FEATURE_COLUMNS)
    X_high = pd.DataFrame([[high[c] for c in FEATURE_COLUMNS]], columns=FEATURE_COLUMNS)
    assert model.predict(X_high)[0] > model.predict(X_low)[0]
