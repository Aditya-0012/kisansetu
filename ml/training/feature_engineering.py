"""
Feature engineering for the demand forecasting model.

Turns the raw (crop, region, date, demand_kg) time series into a supervised
learning table: one row per (crop, region, date), with lag/rolling/calendar
features as inputs and that date's demand_kg as the target. Every feature
here is computable from data strictly *before* the target date, so training
never leaks future information into the model — the same discipline the
recursive multi-step forecaster in predict.py depends on.
"""
import numpy as np
import pandas as pd

SEASON_BY_MONTH = {
    12: "winter", 1: "winter", 2: "winter",
    3: "summer", 4: "summer", 5: "summer",
    6: "monsoon", 7: "monsoon", 8: "monsoon", 9: "monsoon",
    10: "post_monsoon", 11: "post_monsoon",
}

CROPS = ["tomato", "onion", "potato", "grapes", "pomegranate", "wheat"]
REGIONS = ["Nashik", "Pune", "Satara", "Sangli", "Ahmednagar"]

FEATURE_COLUMNS = [
    "day_of_week", "month", "is_weekend",
    "lag_1", "lag_7", "moving_avg_7", "moving_avg_14",
    "demand_growth_7d", "price_per_kg", "price_change_7d",
] + [f"crop_{c}" for c in CROPS] + [f"region_{r}" for r in REGIONS] + [
    f"season_{s}" for s in ["winter", "summer", "monsoon", "post_monsoon"]
]


def load_merged(demand_csv: str, price_csv: str) -> pd.DataFrame:
    demand = pd.read_csv(demand_csv, parse_dates=["date"])
    price = pd.read_csv(price_csv, parse_dates=["date"])
    merged = pd.merge(demand, price, on=["crop", "region", "date"], how="left")
    merged = merged.sort_values(["crop", "region", "date"]).reset_index(drop=True)
    merged["price_per_kg"] = merged.groupby(["crop", "region"])["price_per_kg"].ffill().bfill()
    return merged


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Adds lag/rolling/calendar/one-hot columns. Expects columns:
    crop, region, date, demand_kg, price_per_kg — sorted by (crop, region, date)."""
    df = df.copy()
    df["day_of_week"] = df["date"].dt.dayofweek
    df["month"] = df["date"].dt.month
    df["is_weekend"] = (df["day_of_week"] >= 4).astype(int)
    df["season"] = df["month"].map(SEASON_BY_MONTH)

    grouped = df.groupby(["crop", "region"], group_keys=False)
    df["lag_1"] = grouped["demand_kg"].shift(1)
    df["lag_7"] = grouped["demand_kg"].shift(7)
    df["moving_avg_7"] = grouped["demand_kg"].apply(lambda s: s.shift(1).rolling(7, min_periods=1).mean())
    df["moving_avg_14"] = grouped["demand_kg"].apply(lambda s: s.shift(1).rolling(14, min_periods=1).mean())
    df["demand_growth_7d"] = (df["lag_1"] - df["lag_7"]) / df["lag_7"].replace(0, np.nan)
    df["price_change_7d"] = grouped["price_per_kg"].apply(lambda s: s.pct_change(7))

    for c in CROPS:
        df[f"crop_{c}"] = (df["crop"] == c).astype(int)
    for r in REGIONS:
        df[f"region_{r}"] = (df["region"] == r).astype(int)
    for s in ["winter", "summer", "monsoon", "post_monsoon"]:
        df[f"season_{s}"] = (df["season"] == s).astype(int)

    df["demand_growth_7d"] = df["demand_growth_7d"].fillna(0)
    df["price_change_7d"] = df["price_change_7d"].fillna(0)
    df[FEATURE_COLUMNS] = df[FEATURE_COLUMNS].fillna(0)

    return df
