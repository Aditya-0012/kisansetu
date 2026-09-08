"""
Recursive multi-step demand forecasting using the trained RandomForest.

The model predicts one day at a time. To forecast N days out, each
prediction is appended to the working history and the lag/rolling features
are recomputed before predicting the next day — this is the standard
"recursive forecasting" strategy for tree-based models, which don't natively
support direct multi-step regression the way an ARIMA-family model would.

Confidence intervals come from the spread of predictions across the forest's
individual trees (RandomForest is an ensemble — each of the 200 trees votes,
and their disagreement is a genuine, if rough, uncertainty signal) rather
than a single point estimate with an arbitrary error bar.
"""
import os
import sys

import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from training.feature_engineering import build_features, load_merged, FEATURE_COLUMNS  # noqa: E402

ML_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ML_DIR, "data")
MODELS_DIR = os.path.join(ML_DIR, "models")

_model_bundle = None


def _load_model():
    global _model_bundle
    if _model_bundle is None:
        path = os.path.join(MODELS_DIR, "demand_forecast_rf.joblib")
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"No trained model at {path}. Run: python3 ml/training/train_forecast.py"
            )
        _model_bundle = joblib.load(path)
    return _model_bundle


def _tree_prediction_interval(model, X_row: pd.DataFrame, z: float = 1.28):
    """Predict via every tree in the forest individually; use their spread
    as an empirical ~80% confidence band around the ensemble mean."""
    X_values = X_row.to_numpy()
    per_tree = np.array([tree.predict(X_values)[0] for tree in model.estimators_])
    mean = float(per_tree.mean())
    std = float(per_tree.std())
    return mean, max(0.0, mean - z * std), mean + z * std


def forecast(crop: str, region: str, horizon_days: int = 7):
    bundle = _load_model()
    model, feature_columns = bundle["model"], bundle["feature_columns"]

    raw = load_merged(os.path.join(DATA_DIR, "historical_demand.csv"), os.path.join(DATA_DIR, "historical_price.csv"))
    series = raw[(raw["crop"] == crop) & (raw["region"] == region)].sort_values("date").reset_index(drop=True)
    if len(series) < 20:
        raise ValueError(f"Not enough history for {crop}/{region} ({len(series)} rows)")

    working = series.copy()
    last_price = working["price_per_kg"].iloc[-1]
    forecast_rows = []

    for step in range(1, horizon_days + 1):
        featured = build_features(working)
        last_row = featured.iloc[[-1]][feature_columns].fillna(0)
        mean, lower, upper = _tree_prediction_interval(model, last_row)
        mean = max(0.0, mean)
        lower = max(0.0, lower)

        next_date = working["date"].iloc[-1] + pd.Timedelta(days=1)
        forecast_rows.append({"date": next_date, "forecast": mean, "lower": lower, "upper": upper})

        working = pd.concat([working, pd.DataFrame([{
            "crop": crop, "region": region, "date": next_date,
            "demand_kg": mean, "orders_count": np.nan, "price_per_kg": last_price,
        }])], ignore_index=True)

    expected_demand_kg = sum(r["forecast"] for r in forecast_rows)
    lower_bound_kg = sum(r["lower"] for r in forecast_rows)
    upper_bound_kg = sum(r["upper"] for r in forecast_rows)

    recent_actual = series["demand_kg"].tail(horizon_days)
    recent_avg = float(recent_actual.mean()) if len(recent_actual) else 0.0
    forecast_avg = expected_demand_kg / horizon_days
    growth_percent = 0.0 if recent_avg == 0 else round(((forecast_avg - recent_avg) / recent_avg) * 100, 2)
    trend = "rising" if growth_percent > 3 else "falling" if growth_percent < -3 else "stable"

    # Confidence: tighter tree-spread + more history = higher confidence,
    # same spirit as the Node fallback's blend, so the two paths feel like
    # one product even though only one of them is "real ML".
    avg_band_width = np.mean([(r["upper"] - r["lower"]) for r in forecast_rows])
    relative_band = avg_band_width / max(1.0, forecast_avg)
    confidence = float(np.clip(0.95 - relative_band * 0.5, 0.35, 0.95))

    series_out = [
        {"date": d.strftime("%Y-%m-%d"), "actual": float(v), "forecast": None, "lower_bound": None, "upper_bound": None}
        for d, v in zip(series["date"].tail(45), series["demand_kg"].tail(45))
    ] + [
        {
            "date": r["date"].strftime("%Y-%m-%d"), "actual": None,
            "forecast": round(r["forecast"], 2), "lower_bound": round(r["lower"], 2), "upper_bound": round(r["upper"], 2),
        }
        for r in forecast_rows
    ]

    return {
        "expected_demand_kg": round(expected_demand_kg, 2),
        "lower_bound_kg": round(lower_bound_kg, 2),
        "upper_bound_kg": round(upper_bound_kg, 2),
        "growth_percent": growth_percent,
        "confidence": round(confidence, 2),
        "trend": trend,
        "model_name": "RandomForestRegressor(n_estimators=200)",
        "series": series_out,
    }


if __name__ == "__main__":
    import json
    result = forecast("tomato", "Pune", horizon_days=7)
    print(json.dumps(result, indent=2, default=str))
