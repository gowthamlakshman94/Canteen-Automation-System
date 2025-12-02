import os
import pandas as pd
from flask import Flask, render_template, jsonify
from sqlalchemy import create_engine

app = Flask(__name__)

# Connect to Database (Same credentials as before)
db_user = os.getenv('DB_USER')
db_pass = os.getenv('DB_PASS')
db_host = os.getenv('DB_HOST')
db_name = os.getenv('DB_NAME')

connection_str = f'mysql+pymysql://{db_user}:{db_pass}@{db_host}/{db_name}'
engine = create_engine(connection_str)

@app.route('/')
def dashboard():
    return render_template('index.html')

@app.route('/api/data')
def get_data():
    # Read the predictions table created by your CronJob
    query = "SELECT prediction_date, predicted_revenue, yhat_lower, yhat_upper FROM sales_predictions ORDER BY prediction_date ASC"
    df = pd.read_sql(query, engine)
    
    # Convert to format suitable for Chart.js
    return jsonify({
        'dates': df['prediction_date'].astype(str).tolist(),
        'revenue': df['predicted_revenue'].tolist(),
        'lower': df['yhat_lower'].tolist(),
        'upper': df['yhat_upper'].tolist()
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
