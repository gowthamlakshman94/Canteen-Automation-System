// server.js (corrected)

/* -------------------------
   Required modules
   ------------------------- */
const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = 3000;
const bcrypt = require('bcrypt');

const multer = require('multer');
const nodemailer = require('nodemailer');
const { google } = require('googleapis'); // kept in case used elsewhere
const axios = require('axios');
const dayjs = require('dayjs');
const dotenv = require('dotenv');

dotenv.config(); // loads .env locally; in k8s env comes from secrets

/* -------------------------
   Runtime config (env vars)
   ------------------------- */
// HuggingFace / Chronos
const HF_API_KEY = process.env.HF_API_KEY || process.env.HF_KEY || '';
const HF_CHRONOS_MODEL = process.env.HF_CHRONOS_MODEL || 'amazon/chronos-bolt-base';
const HF_API_URL = process.env.HF_API_URL || 'https://api-inference.huggingface.co/models';
const DEFAULT_PREDICTION_LENGTH = Number(process.env.DEFAULT_PREDICTION_LENGTH || 30);

// Database envs
const MYSQL_HOST = process.env.MYSQL_HOST || 'mysql';
const MYSQL_USER = process.env.MYSQL_USER || 'root';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || 'password';
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'canteen_automation';

// Gmail envs (single declaration only)
const GOOGLE_SENDER_EMAIL = process.env.GOOGLE_SENDER_EMAIL || '';
const GOOGLE_APP_PASSWORD = process.env.GOOGLE_APP_PASSWORD || '';

// helpers
function isHFConfigured() { return !!HF_API_KEY; }
function isEmailConfigured() { return !!(GOOGLE_SENDER_EMAIL && GOOGLE_APP_PASSWORD); }

/* -------------------------
   Multer setup
   ------------------------- */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB max
});

/* -------------------------
   Middleware
   ------------------------- */
app.use(bodyParser.json());
app.use(cors());

/* -------------------------
   MySQL Connection Pool Setup
   ------------------------- */
const dbPool = mysql.createPool({
  connectionLimit: 10,
  host: MYSQL_HOST,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: MYSQL_DATABASE,
  waitForConnections: true,
  queueLimit: 0,
  connectTimeout: 10000,
});

function handleDBConnection() {
  dbPool.getConnection((err, connection) => {
    if (err) {
      console.error('Database connection failed:', err.stack || err);
      setTimeout(handleDBConnection, 5000);
    } else {
      console.log('Connected to MySQL database.');
      connection.release();
    }
  });
}
handleDBConnection();

/* -------------------------
   Email helpers (Gmail - App Password)
   ------------------------- */
if (!isEmailConfigured()) {
  console.warn('Email not configured: set GOOGLE_SENDER_EMAIL and GOOGLE_APP_PASSWORD to enable email sending.');
}

function createSmtpTransporter() {
  if (!isEmailConfigured()) {
    throw new Error('Email not configured (missing GOOGLE_SENDER_EMAIL or GOOGLE_APP_PASSWORD).');
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GOOGLE_SENDER_EMAIL,
      pass: GOOGLE_APP_PASSWORD
    }
  });
}

async function sendEmail({ to, subject, text, html }) {
  if (!isEmailConfigured()) {
    const msg = 'Email skipped: App Password is not configured';
    console.warn(msg);
    throw new Error(msg);
  }
  if (!to || !subject) throw new Error('Missing "to" or "subject"');

  const transporter = createSmtpTransporter();
  const mailOptions = {
    from: `"IIT Patna Canteen" <${GOOGLE_SENDER_EMAIL}>`,
    to,
    subject,
    text: text || '',
    html: html || text || ''
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
}

/* -------------------------
   Generic Email API
   ------------------------- */
app.post('/api/sendEmail', async (req, res) => {
  try {
    const { to, subject, text, html } = req.body || {};
    if (!to || !subject) return res.status(400).json({ success: false, message: 'Missing "to" or "subject"' });

    if (!isEmailConfigured()) {
      console.warn('/api/sendEmail called but email not configured');
      return res.status(503).json({ success: false, message: 'Email service not configured on server' });
    }

    const info = await sendEmail({ to, subject, text, html });
    return res.json({ success: true, info });
  } catch (err) {
    console.error('/api/sendEmail error:', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, message: 'Failed to send email', error: String(err && err.message ? err.message : err) });
  }
});

/**********************************************************
 * ----------------- Existing submitOrder ----------------
 * Preserved your original logic; added an async background
 * email send (non-blocking) AFTER insertion succeeds.
 **********************************************************/
app.post('/submitOrder', (req, res) => {
    const { orderId, userEmail, items } = req.body;

    const createdAt = new Date().toISOString().slice(0, 19).replace("T", " ");

    if (!orderId || !userEmail || !items || !Array.isArray(items)) {
        return res.status(400).send({ message: 'Invalid order data' });
    }

    const values = items.map(item => [
        orderId,
        userEmail,
        item.itemName,
        item.price,
        item.quantity,
        item.delivered ? 1 : 0,
        createdAt
    ]);

    const sql = `
        INSERT INTO orders (order_id, user_email, item_name, price, quantity, delivered, createdAt)
        VALUES ?
    `;

    dbPool.query(sql, [values], (err, result) => {
        if (err) {
            console.error('Error inserting order:', err);
            return res.status(500).send({ message: 'Error submitting order' });
        }

        res.status(200).send({ message: 'Order submitted successfully', orderId: orderId });

        (async () => {
          try {
            if (!userEmail || userEmail === 'unknown' || !isEmailConfigured()) {
              if (!isEmailConfigured()) console.warn('Email not configured; skipping confirmation email');
              return;
            }

            const itemsHtml = items.map(it => {
              const name = String(it.itemName || '').replace(/&/g,'&amp;').replace(/</g,'&lt;');
              const price = Number(it.price || 0).toFixed(2);
              const qty = Number(it.quantity || 0);
              return `<li>${name} — ₹${price} × ${qty}</li>`;
            }).join('');

            const html = `
              <div style="font-family:Arial, sans-serif; line-height:1.4;">
                <h2>Order Confirmation — #${orderId}</h2>
                <p>Hi ${userEmail},</p>
                <p>Thanks for your order. Here are the details:</p>
                <ul>${itemsHtml}</ul>
                <p><strong>Placed at:</strong> ${createdAt}</p>
                <p>Regards,<br/>IIT Patna Canteen</p>
              </div>
            `;
            const subject = `Order Confirmation — #${orderId}`;

            await sendEmail({ to: userEmail, subject, html });
            console.log(`Confirmation email sent to ${userEmail} for order ${orderId}`);
          } catch (emailErr) {
            console.error('Error sending confirmation email (non-fatal):', emailErr && emailErr.message ? emailErr.message : emailErr);
          }
        })();
    });
});

/* -------------------------
   Orders API
   ------------------------- */
app.get('/api/orders', (req, res) => {
  const query = 'SELECT * FROM orders';
  dbPool.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching orders:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(results);
  });
});

/* -------------------------
   Delivery status update
   ------------------------- */
app.post('/api/updateDeliveryStatus', (req, res) => {
  const { order_id, item_name, delivered } = req.body;

  if (typeof delivered !== 'boolean' || !order_id || !item_name) {
    return res.status(400).json({ message: 'Invalid data' });
  }

  const query = 'UPDATE orders SET delivered = ? WHERE order_id = ? AND item_name = ?';

  dbPool.query(query, [delivered, order_id, item_name], (err, results) => {
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

/* -------------------------
   Daily metrics
   ------------------------- */
app.get('/api/dailyMetrics', (req, res) => {
  const query = `
    SELECT
      SUM(price * quantity) AS totalSales,
      COUNT(DISTINCT order_id) AS totalOrders,
      SUM(quantity) AS totalItems
    FROM orders
    WHERE DATE(createdAt) = CURDATE();
  `;

  dbPool.query(query, (err, result) => {
    if (err) {
      console.error('Error fetching daily metrics:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    const metrics = result[0] || {};
    res.json({
      totalSales: metrics.totalSales || 0,
      totalOrders: metrics.totalOrders || 0,
      totalItems: metrics.totalItems || 0,
    });
  });
});

/* -------------------------
   Item metrics
   ------------------------- */
app.get('/api/itemMetrics', (req, res) => {
  const { from, to } = req.query;

  let sql = `
    SELECT
      item_name,
      SUM(price * quantity) AS totalSales,
      SUM(quantity) AS totalQuantity,
      MIN(createdAt) AS createdAt
    FROM orders
  `;
  const params = [];

  if (from && to) {
    sql += `
      WHERE createdAt BETWEEN ? AND ?
    `;
    params.push(from + ' 00:00:00', to + ' 23:59:59');
  }

  sql += `
    GROUP BY item_name
    ORDER BY totalSales DESC
  `;

  dbPool.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error fetching item metrics:', err);
      return res.status(500).send({ error: true, message: 'Error fetching item metrics' });
    }
    res.send({ metrics: results });
  });
});

/* -------------------------
   Daily item insertion (wastage tracking)
   ------------------------- */
app.post('/daily-item', (req, res) => {
    const { item_name, quantity_prepared, date } = req.body;

    if (!item_name || !quantity_prepared || !date) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    const query = 'INSERT INTO daily_item_quantity (item_name, quantity_prepared, date) VALUES (?, ?, ?)';
    dbPool.query(query, [item_name, quantity_prepared, date], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Database error.' });
        }
        res.status(200).json({ message: 'Data inserted successfully.', id: result.insertId });
    });
});

/* -------------------------
   Daily wastage report
   ------------------------- */
app.get('/daily-wastage', (req, res) => {
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ message: 'Date is required.' });
    }

    const query = `
        SELECT 
            diq.item_name, 
            diq.quantity_prepared, 
            IFNULL(SUM(o.quantity), 0) AS quantity_ordered, 
            (diq.quantity_prepared - IFNULL(SUM(o.quantity), 0)) AS wastage
        FROM 
            daily_item_quantity diq
        LEFT JOIN 
            orders o
        ON 
            diq.item_name = o.item_name AND DATE(o.createdAt) = ?
        WHERE 
            diq.date = ?
        GROUP BY 
            diq.item_name, diq.quantity_prepared;
    `;

    dbPool.query(query, [date, date], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Database error.' });
        }
        res.status(200).json(results);
    });
});

/* -------------------------
   Seasonal Data
   ------------------------- */
app.get('/api/seasonalData', (req, res) => {
  const query = `
    SELECT 
      item_name, 
      SUM(quantity) AS total_quantity, 
      MONTH(createdAt) AS month 
    FROM orders 
    GROUP BY item_name, MONTH(createdAt);
  `;

  dbPool.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching seasonal data:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    const seasons = {
      Spring: [3, 4, 5],
      Summer: [6, 7, 8],
      Autumn: [9, 10, 11],
      Winter: [12, 1, 2],
    };

    const currentMonth = new Date().getMonth() + 1;
    const seasonNames = Object.keys(seasons);

    let currentSeasonIndex = seasonNames.findIndex((season) =>
      seasons[season].includes(currentMonth)
    );
    const selectedSeasons = [];
    for (let i = 0; i < 4; i++) {
      selectedSeasons.unshift(seasonNames[currentSeasonIndex]);
      currentSeasonIndex = (currentSeasonIndex - 1 + seasonNames.length) % seasonNames.length;
    }

    const seasonData = selectedSeasons.reduce((acc, season) => {
      const months = seasons[season];
      const filteredData = results.filter((item) => months.includes(item.month));

      const aggregatedData = filteredData.reduce((seasonAcc, item) => {
        seasonAcc[item.item_name] = (seasonAcc[item.item_name] || 0) + item.total_quantity;
        return seasonAcc;
      }, {});

      const sortedItems = Object.entries(aggregatedData).sort(([, a], [, b]) => b - a);

      acc[season] = {
        top5: sortedItems.slice(0, 5),
        bottom5: sortedItems.slice(-5),
      };
      return acc;
    }, {});

    res.json({
      selectedSeasons,
      seasonData,
    });
  });
});

/* -------------------------
   Register / Login
   ------------------------- */
app.post('/register', (req, res) => {
    const { name, email, password, contact, city, address } = req.body;
    const hash = bcrypt.hashSync(password, 10);

    dbPool.query(
        'INSERT INTO users (name, email, password, contact, city, address) VALUES (?, ?, ?, ?, ?, ?)', 
        [name, email, hash, contact, city, address], 
        (err, result) => {
            if (err) {
                console.error("Database Insert Error:", err);
                return res.json({ success: false, message: "Database error" });
            }
            res.json({ success: true });
        }
    );
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    dbPool.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error("Database Query Error:", err);
            return res.json({ success: false, message: "Database error" });
        }

        if (results.length === 0) {
            return res.json({ success: false, message: "User not found" });
        }

        const user = results[0];
        if (bcrypt.compareSync(password, user.password)) {
            res.json({ success: true });
        } else {
            res.json({ success: false, message: "Invalid password" });
        }
    });
});

/* -------------------------
   Check Order endpoint
   ------------------------- */
app.get('/checkOrder/:orderId', (req, res) => {
    const orderId = req.params.orderId;

    const query = 'SELECT * FROM orders WHERE order_id = ?';

    dbPool.query(query, [orderId], (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (results.length > 0) {
            res.json({ exists: true });
        } else {
            res.json({ exists: false });
        }
    });
});

/* -------------------------
   Menu endpoints
   ------------------------- */
app.post('/api/menu', upload.single('image'), (req, res) => {
  try {
    const { name, description, price, category, available } = req.body;

    if (!name || !price) {
      return res.status(400).json({ success: false, message: 'name and price are required' });
    }

    let image_blob = null;
    let image_mime = null;
    let image_filename = null;

    if (req.file) {
      image_blob = req.file.buffer;
      image_mime = req.file.mimetype;
      image_filename = req.file.originalname;
    }

    const sql = `
      INSERT INTO menu_items
        (name, description, price, category, available, image_blob, image_mime, image_filename)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const availableFlag = (available === undefined || available === '' ? 1 : (available == '0' ? 0 : 1));

    dbPool.query(
      sql,
      [
        name,
        description || null,
        parseFloat(price),
        category || null,
        availableFlag,
        image_blob,
        image_mime,
        image_filename || null
      ],
      (err, result) => {
        if (err) {
          console.error('Error inserting menu item:', err);
          return res.status(500).json({ success: false, message: 'DB insert error' });
        }
        return res.status(201).json({ success: true, data: { id: result.insertId } });
      }
    );
  } catch (err) {
    console.error('POST /api/menu error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/menu', (req, res) => {
  const { category } = req.query;
  let sql = 'SELECT id, name, description, price, category, available FROM menu_items WHERE available = 1';
  const params = [];
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ' ORDER BY id';

  dbPool.query(sql, params, (err, rows) => {
    if (err) {
      console.error('Error fetching menu:', err);
      return res.status(500).json({ success: false, message: 'DB error' });
    }
    const items = rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      price: parseFloat(r.price),
      category: r.category,
      available: r.available,
      image_url: `/api/menu/${r.id}/image`
    }));
    res.json({ success: true, data: items });
  });
});

app.get('/api/menu/:id/image', (req, res) => {
  const id = req.params.id;
  const sql = 'SELECT image_blob, image_mime, image_filename FROM menu_items WHERE id = ? LIMIT 1';
  dbPool.query(sql, [id], (err, rows) => {
    if (err) {
      console.error('Error fetching image blob:', err);
      return res.status(500).send('Server error');
    }
    if (!rows || rows.length === 0) return res.status(404).send('Not found');
    const row = rows[0];
    if (!row.image_blob) return res.status(404).send('No image');

    const mime = row.image_mime || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(row.image_blob);
  });
});

/* -------------------------
   Health check
   ------------------------- */
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

/* -------------------------
   Order retrieval endpoints
   ------------------------- */
app.get('/api/order/:orderId', (req, res) => {
  const orderId = req.params.orderId;
  if (!orderId) return res.status(400).json({ success: false, message: 'orderId required' });

  const sql = 'SELECT order_id, user_email, item_name, price, quantity, createdAt FROM orders WHERE order_id = ? ORDER BY createdAt ASC';
  dbPool.query(sql, [orderId], (err, rows) => {
    if (err) {
      console.error('Error fetching order:', err);
      return res.status(500).json({ success: false, message: 'DB error' });
    }
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });

    const order = {
      orderId: rows[0].order_id,
      userEmail: rows[0].user_email,
      createdAt: rows[0].createdAt,
      items: rows.map(r => ({ itemName: r.item_name, price: Number(r.price), quantity: Number(r.quantity) })),
    };
    order.total = order.items.reduce((s, it) => s + (Number(it.price) * Number(it.quantity || 0)), 0);
    return res.json({ success: true, order });
  });
});

app.get('/api/orders/latest', (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ success: false, message: 'email query param required' });

  const sql = `SELECT order_id, MAX(createdAt) AS last_time
               FROM orders
               WHERE user_email = ?
               GROUP BY order_id
               ORDER BY last_time DESC
               LIMIT 1`;
  dbPool.query(sql, [email], (err, rows) => {
    if (err) {
      console.error('Error fetching latest order id:', err);
      return res.status(500).json({ success: false, message: 'DB error' });
    }
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: 'No orders found for this email' });

    const latestOrderId = rows[0].order_id;
    const sql2 = 'SELECT order_id, user_email, item_name, price, quantity, createdAt FROM orders WHERE order_id = ? ORDER BY createdAt ASC';
    dbPool.query(sql2, [latestOrderId], (err2, rows2) => {
      if (err2) {
        console.error('Error fetching order details:', err2);
        return res.status(500).json({ success: false, message: 'DB error' });
      }
      if (!rows2 || rows2.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });

      const order = {
        orderId: rows2[0].order_id,
        userEmail: rows2[0].user_email,
        createdAt: rows2[0].createdAt,
        items: rows2.map(r => ({ itemName: r.item_name, price: Number(r.price), quantity: Number(r.quantity) }))
      };
      order.total = order.items.reduce((s, it) => s + (Number(it.price) * Number(it.quantity || 0)), 0);
      return res.json({ success: true, order });
    });
  });
});

/* -------------------------
   Chronos: call helper
   ------------------------- */
async function callChronosModel(payload) {
  if (!isHFConfigured()) throw new Error('HF_API_KEY not configured');
  const url = `${HF_API_URL}/${HF_CHRONOS_MODEL}`;
  const res = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${HF_API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 120000
  });
  return res.data;
}

/* -------------------------
   Forecast endpoint (aggregates DB, calls Chronos)
   ------------------------- */
function getDailySeries(callback) {
  const sql = `
    SELECT DATE(createdAt) AS ds, SUM(price * quantity) AS y
    FROM orders
    WHERE delivered = TRUE
    GROUP BY DATE(createdAt)
    ORDER BY ds;
  `;
  dbPool.query(sql, (err, rows) => {
    if (err) {
      console.error('DB error in getDailySeries:', err);
      return callback(err);
    }
    const series = (rows || []).map(r => ({
      ds: dayjs(r.ds).format('YYYY-MM-DD'),
      y: Number(r.y || 0)
    }));
    callback(null, series);
  });
}

app.get('/api/forecast', (req, res) => {
  const days = Number(req.query.days || DEFAULT_PREDICTION_LENGTH || 30);

  if (!isHFConfigured()) {
    return res.status(503).json({ error: 'Forecast service not configured (HF_API_KEY missing).' });
  }

  getDailySeries(async (err, series) => {
    if (err) return res.status(500).json({ error: 'DB error building timeseries' });
    if (!series || series.length < 5) {
      return res.status(400).json({ error: 'Not enough historical data (need at least ~5 days).', history: series });
    }

    try {
      const past_values = series.map(s => s.y);
      const payload = {
        inputs: {
          past_values,
          predict_length: days
        },
        parameters: { num_samples: 20 }
      };

      const hfResponse = await callChronosModel(payload);

      let forecasts;
      if (Array.isArray(hfResponse)) {
        forecasts = hfResponse;
      } else if (hfResponse && hfResponse.predictions) {
        forecasts = hfResponse.predictions;
      } else if (hfResponse && hfResponse.samples) {
        const samples = hfResponse.samples;
        const predictLen = samples[0].length;
        const medians = [];
        for (let t = 0; t < predictLen; t++) {
          const vals = samples.map(s => s[t]).sort((a,b)=>a-b);
          medians.push(vals[Math.floor(vals.length/2)]);
        }
        forecasts = medians;
      } else if (hfResponse && hfResponse.forecast) {
        forecasts = hfResponse.forecast;
      } else {
        return res.json({ raw: hfResponse });
      }

      if (!Array.isArray(forecasts)) {
        return res.status(500).json({ error: 'Unexpected HF response shape', raw: hfResponse });
      }

      const lastDate = series[series.length - 1].ds;
      const out = forecasts.slice(0, days).map((val, i) => ({
        ds: dayjs(lastDate).add(i + 1, 'day').format('YYYY-MM-DD'),
        yhat: Number(val)
      }));

      const history = series.slice(-90);
      return res.json({ history, forecast: out });
    } catch (hfErr) {
      console.error('Chronos/HTTP error:', hfErr?.response?.data ?? hfErr.message ?? hfErr);
      return res.status(500).json({ error: 'Forecasting failed', detail: hfErr?.response?.data ?? hfErr.message });
    }
  });
});

/* -------------------------
   Start server
   ------------------------- */
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
