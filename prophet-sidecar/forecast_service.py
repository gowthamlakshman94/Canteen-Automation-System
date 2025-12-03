#!/usr/bin/env python3
# forecast_service.py
# Flask service that receives past_values and returns a Prophet forecast.

from flask import Flask, request, jsonify
from prophet import Prophet
import pandas as pd
import traceback
import os

app = Flask(__name__)

def build_df(past_values, past_dates=None, last_date=None):
    if past_dates and len(past_dates) == len(past_values):
        ds = pd.to_datetime(past_dates)
    else:
        if last_date:
            end = pd.to_datetime(last_date)
        else:
            end = pd.Timestamp.today().normalize()
        ds = pd.date_range(end=end, periods=len(past_values), freq='D')
    df = pd.DataFrame({"ds": ds, "y": past_values})
    return df

@app.route("/health", methods=["GET"])
def health():
    return "OK", 200

@app.route("/forecast", methods=["POST"])
def forecast():
    try:
        payload = request.get_json(force=True)
        past_values = payload.get("past_values") or payload.get("y") or []
        past_dates = payload.get("past_dates", None)
        predict_length = int(payload.get("predict_length", payload.get("days", 14)))
        last_date = payload.get("last_date", None)

        if not past_values or len(past_values) < 2:
            return jsonify({"error":"Not enough data (need >=2 points)"}), 400

        df = build_df(past_values, past_dates, last_date)

        # Fit Prophet
        m = Prophet(daily_seasonality=True, weekly_seasonality=True, yearly_seasonality=True)
        m.fit(df)

        future = m.make_future_dataframe(periods=predict_length, freq='D')
        fcst = m.predict(future)

        hist = [{"ds": d.strftime("%Y-%m-%d"), "y": float(y)} for d, y in zip(df["ds"], df["y"])]
        frows = fcst.iloc[len(df): len(df) + predict_length]
        forecast_out = [{"ds": row["ds"].strftime("%Y-%m-%d"), "yhat": float(row["yhat"])} for _, row in frows.iterrows()]

        return jsonify({"history": hist, "forecast": forecast_out})
    except Exception as e:
        tb = traceback.format_exc()
        return jsonify({"error":"exception", "detail": str(e), "trace": tb}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
