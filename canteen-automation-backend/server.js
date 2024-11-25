const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors()); // Enable CORS for all domains (or restrict it to your frontend domain if needed)

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
    const { orderId, items } = req.body;
    
    // Generate current timestamp in YYYY-MM-DD HH:MM:SS format
    const createdAt = new Date().toISOString().slice(0, 19).replace("T", " ");  // '2024-11-25 11:46:48'

    if (!orderId || !items || !Array.isArray(items)) {
        return res.status(400).send({ message: 'Invalid order data' });
    }

    const values = items.map(item => [
        orderId,
        item.itemName,
        item.price,
        item.quantity,
        item.delivered ? 1 : 0,
        createdAt  // Add createdAt in correct format
    ]);

    const sql = `
        INSERT INTO orders (order_id, item_name, price, quantity, delivered, createdAt)
        VALUES ?
    `;

    db.query(sql, [values], (err, result) => {
        if (err) {
            console.error('Error inserting order:', err);
            return res.status(500).send({ message: 'Error submitting order' });
        }
        res.status(200).send({ message: 'Order submitted successfully' });
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

// Update delivery status for a specific item in an order
app.post('/api/updateDeliveryStatus', (req, res) => {
  const { order_id, item_name, delivered } = req.body;

  if (typeof delivered !== 'boolean' || !order_id || !item_name) {
    return res.status(400).json({ message: 'Invalid data' });
  }

  const query = 'UPDATE orders SET delivered = ? WHERE order_id = ? AND item_name = ?';

  db.query(query, [delivered, order_id, item_name], (err, results) => {
    if (err) {
      console.error('Error updating delivery status:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json({ success: true, message: 'Delivery status updated successfully' });
  });
});

// API to fetch daily metrics
app.get('/api/dailyMetrics', (req, res) => {
  const query = `
    SELECT
      SUM(price * quantity) AS totalSales,
      COUNT(DISTINCT order_id) AS totalOrders,
      SUM(quantity) AS totalItems
    FROM orders
    WHERE DATE(createdAt) = CURDATE();
  `;

  db.query(query, (err, result) => {
    if (err) {
      console.error('Error fetching daily metrics:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    const metrics = result[0];
    res.json({
      totalSales: metrics.totalSales || 0,
      totalOrders: metrics.totalOrders || 0,
      totalItems: metrics.totalItems || 0,
    });
  });
});

// API to fetch item-wise metrics
app.get('/api/itemMetrics', (req, res) => {
  const { date } = req.query;

  // Parse the provided date into start and end timestamps
  const startDate = date ? new Date(date + 'T00:00:00Z').getTime() : null;
  const endDate = date ? new Date(date + 'T23:59:59Z').getTime() : null;

  let sql = `
    SELECT
      item_name,
      SUM(price * quantity) AS totalSales,
      SUM(quantity) AS totalQuantity,
      MIN(createdAt) AS createdAt
    FROM orders
  `;
  const params = [];

  if (startDate && endDate) {
    sql += `
      WHERE UNIX_TIMESTAMP(createdAt) BETWEEN ? AND ?
    `;
    params.push(startDate / 1000, endDate / 1000);
  }

  sql += `
    GROUP BY item_name
    ORDER BY totalSales DESC
  `;

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error fetching item metrics:', err);
      return res.status(500).send({ error: true, message: 'Error fetching item metrics' });
    }
    res.send({ metrics: results });
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

