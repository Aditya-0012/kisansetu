"""
Standalone evaluation report — prints the same MAE/RMSE/MAPE metrics.json
that train_forecast.py writes, formatted for a README/demo screenshot
rather than raw JSON. Run this after train_forecast.py.

Usage: python3 ml/training/model_evaluation.py
"""
import json
import os

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")


def main():
    metrics_path = os.path.join(MODELS_DIR, "metrics.json")
    if not os.path.exists(metrics_path):
        print("No metrics.json found. Run train_forecast.py first.")
        return

    with open(metrics_path) as f:
        m = json.load(f)

    print("=" * 60)
    print("KisanSetu Demand Forecast — Model Evaluation")
    print("=" * 60)
    print(f"Trained at:         {m['trained_at']}")
    print(f"Training records:   {m['training_records']}")
    print(f"Holdout records:    {m['holdout_records']} (last {m['holdout_days_per_series']} days per crop/region series)")
    print()
    print(f"{'Metric':<12}{'RandomForest':>16}{'7-day MA baseline':>20}")
    print(f"{'MAE (kg)':<12}{m['model']['mae']:>16}{m['baseline']['mae']:>20}")
    print(f"{'RMSE (kg)':<12}{m['model']['rmse']:>16}{m['baseline']['rmse']:>20}")
    print(f"{'MAPE (%)':<12}{m['model']['mape_percent']:>16}{m['baseline']['mape_percent']:>20}")
    print()
    print(f"RandomForest improves on the naive moving-average baseline by "
          f"{m['improvement_over_baseline_percent']}% (lower MAE).")
    print()
    print("Top predictive features:")
    for name, importance in m["top_features"]:
        bar = "#" * int(importance * 40)
        print(f"  {name:<20} {importance:.3f}  {bar}")
    print("=" * 60)


if __name__ == "__main__":
    main()
