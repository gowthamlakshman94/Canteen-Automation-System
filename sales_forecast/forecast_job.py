
import pandas as pd
from sqlalchemy import create_engine
from prophet import Prophet
import os

# 1. Get Credentials from Environment Variables (Best Practice for K8s)
db_user = os.getenv('DB_USER')
db_pass = os.getenv('DB_PASS')
db_host = os.getenv('DB_HOST')
db_name = os.getenv('DB_NAME')

connection_str = f'mysql+pymysql://{db_user}:{db_pass}@{db_host}/{db_name}'
engine = create_engine(connection_str)

# 2. Fetch Data
query = """
SELECT DATE(createdAt) as ds, SUM(price * quantity) as y
FROM orders WHERE delivered = TRUE
GROUP BY DATE(createdAt) ORDER BY ds ASC;
"""
df = pd.read_sql(query, engine)
df['ds'] = pd.to_datetime(df['ds'])

# 3. Train Model
model = Prophet()
model.fit(df)

# 4. Predict Next 30 Days
future = model.make_future_dataframe(periods=30)
forecast = model.predict(future)

# 5. Save Results Back to SQL (New Table: sales_predictions)
output_df = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(30)
output_df.rename(columns={'ds': 'prediction_date', 'yhat': 'predicted_revenue'}, inplace=True)

# Write to MySQL (Replace table if exists)
output_df.to_sql('sales_predictions', engine, if_exists='replace', index=False)

print("Forecast completed and saved to 'sales_predictions' table.")
