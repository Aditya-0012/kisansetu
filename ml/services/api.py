"""
Lightweight Flask API exposing the trained forecasting model over HTTP, so
the Node backend (services/forecast.service.ts) can call it as an optional
upgrade over the internal TypeScript fallback.

Run: python3 ml/services/api.py  (defaults to :8000, matches ML_SERVICE_URL
in .env.example)

If this process isn't running, forecastService in the Node API silently
falls back to its own linear-trend model — the product never breaks for
lack of the ML service, per spec section 44.
"""
import os
import sys

from flask import Flask, jsonify, request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from prediction.predict import forecast  # noqa: E402

app = Flask(__name__)

VALID_CROPS = {"tomato", "onion", "potato", "grapes", "pomegranate", "wheat"}
VALID_REGIONS = {"Nashik", "Pune", "Satara", "Sangli", "Ahmednagar"}


@app.get("/health")
def health():
    return jsonify({"status": "ok", "service": "kisansetu-ml"})


@app.post("/predict")
def predict():
    body = request.get_json(force=True, silent=True) or {}
    crop = body.get("crop")
    region = body.get("region", "Pune")
    horizon_days = int(body.get("horizon_days", 7))

    if crop not in VALID_CROPS:
        return jsonify({"error": f"Unknown crop '{crop}'. Expected one of {sorted(VALID_CROPS)}"}), 400
    if region not in VALID_REGIONS:
        return jsonify({"error": f"Unknown region '{region}'. Expected one of {sorted(VALID_REGIONS)}"}), 400
    if horizon_days not in (7, 14, 30):
        return jsonify({"error": "horizon_days must be 7, 14, or 30"}), 400

    try:
        result = forecast(crop, region, horizon_days)
        return jsonify(result)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:  # noqa: BLE001 — surface any model error as a 500, never crash the process
        app.logger.exception("Forecast failed")
        return jsonify({"error": f"Forecast failed: {e}"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("ML_SERVICE_PORT", 8000))
    app.run(host="0.0.0.0", port=port)
