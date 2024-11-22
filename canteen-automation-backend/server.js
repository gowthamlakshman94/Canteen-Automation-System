// backend/server.js
const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors());  // Enable CORS for all domains (or restrict it to your frontend domain if needed)

// MySQL Connection Setup
const db = mysql.createConnection({
  host: 'mysql', // Replace with your MySQL hostname if needed
  user: 'root', // Replace with your MySQL username
  password: 'password', // Replace with your MySQL password
  database: 'canteen_automation', // Replace with your database name
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err.stack);
    return;
  }
  console.log('Connected to MySQL database.');
});

// API to handle order submission
app.post('/submitOrder', (req, res) => {
  console.log("Received order data:", req.body); // Log the incoming request body

  const { orderId, items } = req.body;

  // Validate the incoming data
  if (!orderId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Invalid order data' });
  }

  // Prepare data for insertion
  const query = `
    INSERT INTO orders (order_id, item_name, price, quantity)
    VALUES ?`;

  const values = items.map((item) => [
    orderId,
    item.itemName,
    item.price,
    item.quantity,
    false  // Assuming orders are not delivered by default
  ]);

  // Insert order into database
  db.query(query, [values], (err, result) => {
    if (err) {
      console.error('Error inserting order:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    console.log('Order successfully inserted:', result);
    res.status(200).json({ message: 'Order submitted successfully' });
  });
});

// API to fetch orders
app.get('/api/orders', (req, res) => {
  const query = 'SELECT * FROM orders';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching orders:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(results);
  });
});

// API to update delivery status
app.post('/api/updateDeliveryStatus', (req, res) => {
  const { order_id, delivered } = req.body;

  if (typeof delivered !== 'boolean') {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const query = 'UPDATE orders SET delivered = ? WHERE order_id = ?';

  db.query(query, [delivered, order_id], (err, results) => {
    if (err) {
      console.error('Error updating delivery status:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    res.json({ success: true });
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

