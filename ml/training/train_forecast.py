"""
Trains KisanSetu's demand forecasting model.

Model: RandomForestRegressor (scikit-learn) — a practical choice for a
small-to-mid-size tabular time series with mixed calendar/lag/categorical
features, per spec section 14. A 7-day moving-average baseline is trained
alongside it purely for comparison, so model_evaluation numbers mean
something (spec: "do not pretend an advanced model exists if it doesn't" —
the flip side of that is also being honest about how much better than a
naive baseline the real model actually is).

Evaluation is a *chronological* holdout (the last 21 days of each
crop/region series), never a random split — a random split on a time series
leaks future rows into training and silently inflates every metric.

Usage: python3 ml/training/train_forecast.py
Outputs: ml/models/demand_forecast_rf.joblib, ml/models/metrics.json
"""
import json
import os
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from training.feature_engineering import build_features, load_merged, FEATURE_COLUMNS  # noqa: E402

ML_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ML_DIR, "data")
MODELS_DIR = os.path.join(ML_DIR, "models")
HOLDOUT_DAYS = 21


def mape(y_true, y_pred):
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    mask = y_true != 0
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)


def main():
    os.makedirs(MODELS_DIR, exist_ok=True)

    raw = load_merged(os.path.join(DATA_DIR, "historical_demand.csv"), os.path.join(DATA_DIR, "historical_price.csv"))
    featured = build_features(raw)

    # Drop the first 14 rows of each crop/region group — their lag/rolling
    # features are partly built on padding, not real history.
    row_rank = featured.groupby(["crop", "region"]).cumcount()
    featured = featured[row_rank >= 14].reset_index(drop=True)

    cutoff_per_group = featured.groupby(["crop", "region"])["date"].transform(lambda s: s.max() - pd.Timedelta(days=HOLDOUT_DAYS))
    train_df = featured[featured["date"] <= cutoff_per_group]
    test_df = featured[featured["date"] > cutoff_per_group]

    X_train, y_train = train_df[FEATURE_COLUMNS], train_df["demand_kg"]
    X_test, y_test = test_df[FEATURE_COLUMNS], test_df["demand_kg"]

    print(f"Training rows: {len(X_train)}  |  Holdout rows: {len(X_test)}")

    model = RandomForestRegressor(
        n_estimators=200,
        max_depth=10,
        min_samples_leaf=3,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    rf_pred = model.predict(X_test)
    rf_mae = mean_absolute_error(y_test, rf_pred)
    rf_rmse = float(np.sqrt(mean_squared_error(y_test, rf_pred)))
    rf_mape = mape(y_test, rf_pred)

    # Naive baseline: "tomorrow's demand = 7-day moving average" — the
    # thing a farmer could do with a calculator and no model at all.
    baseline_pred = test_df["moving_avg_7"].values
    baseline_mae = mean_absolute_error(y_test, baseline_pred)
    baseline_rmse = float(np.sqrt(mean_squared_error(y_test, baseline_pred)))
    baseline_mape = mape(y_test, baseline_pred)

    feature_importances = dict(zip(FEATURE_COLUMNS, model.feature_importances_.tolist()))
    top_features = sorted(feature_importances.items(), key=lambda kv: -kv[1])[:8]

    metrics = {
        "trained_at": pd.Timestamp.now().isoformat(),
        "training_records": int(len(X_train)),
        "holdout_records": int(len(X_test)),
        "holdout_days_per_series": HOLDOUT_DAYS,
        "model": {
            "name": "RandomForestRegressor",
            "n_estimators": 200,
            "max_depth": 10,
            "mae": round(rf_mae, 2),
            "rmse": round(rf_rmse, 2),
            "mape_percent": round(rf_mape, 2),
        },
        "baseline": {
            "name": "7-day moving average",
            "mae": round(baseline_mae, 2),
            "rmse": round(baseline_rmse, 2),
            "mape_percent": round(baseline_mape, 2),
        },
        "improvement_over_baseline_percent": round((1 - rf_mae / baseline_mae) * 100, 1) if baseline_mae else 0,
        "top_features": top_features,
    }

    joblib.dump({"model": model, "feature_columns": FEATURE_COLUMNS}, os.path.join(MODELS_DIR, "demand_forecast_rf.joblib"))
    with open(os.path.join(MODELS_DIR, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    print(json.dumps(metrics, indent=2))
    print(f"\nSaved model to {os.path.join(MODELS_DIR, 'demand_forecast_rf.joblib')}")


if __name__ == "__main__":
    main()
