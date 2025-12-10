// server.js (secured version with JWT + HTTP-only cookie auth)

const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB max
});

const nodemailer = require('nodemailer');
const axios = require('axios');
const dayjs = require('dayjs');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = 3000;

const AUTH_SECRET = process.env.AUTH_SECRET || "CHANGE_ME_SECRET";
// Gmail envs
const GOOGLE_SENDER_EMAIL = process.env.GOOGLE_SENDER_EMAIL || '';
const GOOGLE_APP_PASSWORD = process.env.GOOGLE_APP_PASSWORD || '';

/* CORS + cookies */
app.use(cors({
    origin: true,
    credentials: true
}));

app.use(bodyParser.json());

/* Cookie parser */
const cookieParser = require('cookie-parser');
app.use(cookieParser());

/* MySQL connection */
const dbPool = mysql.createPool({
    connectionLimit: 10,
    host: process.env.MYSQL_HOST || 'mysql',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'password',
    database: process.env.MYSQL_DATABASE || 'canteen_automation',
    waitForConnections: true,
    queueLimit: 0,
    connectTimeout: 10000,
});

/* Login-required middleware */
function requireAuth(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    try {
        const decoded = jwt.verify(token, AUTH_SECRET);
        req.user = decoded; // contains { id, email }
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: "Invalid session" });
    }
}
/* -------------------------
   Register (PUBLIC)
------------------------- */
app.post('/register', (req, res) => {
    const { name, email, password, contact, city, address } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const hash = bcrypt.hashSync(password, 10);

    dbPool.query(
        "INSERT INTO users (name, email, password, contact, city, address) VALUES (?, ?, ?, ?, ?, ?)",
        [name, email, hash, contact || null, city || null, address || null],
        (err, result) => {
            if (err) {
                console.error("Register DB error:", err);
                return res.json({ success: false, message: "Database error" });
            }
            res.json({ success: true });
        }
    );
});

/* -------------------------
   Login (PUBLIC)
------------------------- */
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    dbPool.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
        if (err) {
            console.error("Login DB error:", err);
            return res.json({ success: false, message: "Database error" });
        }

        if (results.length === 0) {
            return res.json({ success: false, message: "User not found" });
        }

        const user = results[0];
        if (!bcrypt.compareSync(password, user.password)) {
            return res.json({ success: false, message: "Invalid password" });
        }

        // Create token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            AUTH_SECRET,
            { expiresIn: "7d" }
        );

        // Set HTTP-only cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: false,      // works on localhost
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.json({ success: true });
    });
});

/* -------------------------
   Logout (PROTECTED)
------------------------- */
app.post('/logout', requireAuth, (req, res) => {
    res.clearCookie("token");
    res.json({ success: true, message: "Logged out" });
});
/* -------------------------
   Health Check (PUBLIC)
------------------------- */
app.get('/health', (req, res) => {
    res.status(200).send("OK");
});

/* ============================================================
   🔐 ALL ROUTES BELOW THIS LINE REQUIRE AUTHENTICATION
   ============================================================ */
app.use(requireAuth);
/* -------------------------
   Generic Email API (PROTECTED)
------------------------- */
app.post('/api/sendEmail', async (req, res) => {
    try {
        const { to, subject, text, html } = req.body || {};
        if (!to || !subject) {
            return res.status(400).json({ success: false, message: "Missing 'to' or 'subject'" });
        }

        if (!isEmailConfigured()) {
            console.warn("Email not configured");
            return res.status(503).json({ success: false, message: "Email service not configured" });
        }

        const info = await sendEmail({ to, subject, text, html });
        return res.json({ success: true, info });
    } catch (err) {
        console.error("Email error:", err);
        return res.status(500).json({ success: false, message: "Failed to send email" });
    }
});

/* -------------------------
   submitOrder (PROTECTED)
------------------------- */
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
            console.error('Order insert error:', err);
            return res.status(500).send({ message: 'Error submitting order' });
        }

        res.status(200).send({ message: 'Order submitted successfully', orderId });

        // Optional async email (non-blocking)
        (async () => {
            try {
                if (!isEmailConfigured()) return;

                const itemsHtml = items.map(it => {
                    return `<li>${it.itemName} — ₹${Number(it.price).toFixed(2)} × ${Number(it.quantity)}</li>`;
                }).join('');

                await sendEmail({
                    to: userEmail,
                    subject: `Order Confirmation — #${orderId}`,
                    html: `
                        <div style="font-family:Arial;">
                            <h2>Order Confirmation — #${orderId}</h2>
                            <ul>${itemsHtml}</ul>
                            <p>Placed at: ${createdAt}</p>
                        </div>
                    `
                });
            } catch (emailErr) {
                console.error("Email async error:", emailErr);
            }
        })();
    });
});

/* -------------------------
   Get All Orders (PROTECTED)
------------------------- */
app.get('/api/orders', (req, res) => {
    dbPool.query("SELECT * FROM orders", (err, results) => {
        if (err) {
            console.error("Orders fetch error:", err);
            return res.status(500).json({ message: "Database error" });
        }
        res.json(results);
    });
});

/* -------------------------
   Update Delivery Status (PROTECTED)
------------------------- */
app.post('/api/updateDeliveryStatus', (req, res) => {
    const { order_id, item_name, delivered } = req.body;

    if (!order_id || !item_name || typeof delivered !== 'boolean') {
        return res.status(400).json({ message: "Invalid data" });
    }

    dbPool.query(
        "UPDATE orders SET delivered = ? WHERE order_id = ? AND item_name = ?",
        [delivered, order_id, item_name],
        (err, results) => {
            if (err) {
                console.error("Delivery update error:", err);
                return res.status(500).json({ message: "Database error" });
            }

            if (results.affectedRows === 0) {
                return res.status(404).json({ message: "Item not found" });
            }

            res.json({ success: true });
        }
    );
});

/* -------------------------
   Daily Metrics (PROTECTED)
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
            console.error("Daily metrics error:", err);
            return res.status(500).json({ message: "DB error" });
        }

        const metrics = result[0] || {};
        res.json({
            totalSales: metrics.totalSales || 0,
            totalOrders: metrics.totalOrders || 0,
            totalItems: metrics.totalItems || 0
        });
    });
});

/* -------------------------
   Item Metrics (PROTECTED)
------------------------- */
app.get('/api/itemMetrics', (req, res) => {
    const { from, to } = req.query;
    let sql = `
        SELECT item_name,
               SUM(price * quantity) AS totalSales,
               SUM(quantity) AS totalQuantity,
               MIN(createdAt) AS createdAt
        FROM orders
    `;
    const params = [];

    if (from && to) {
        sql += ` WHERE createdAt BETWEEN ? AND ? `;
        params.push(from + " 00:00:00", to + " 23:59:59");
    }

    sql += ` GROUP BY item_name ORDER BY totalSales DESC `;

    dbPool.query(sql, params, (err, results) => {
        if (err) {
            console.error("Item metrics error:", err);
            return res.status(500).send({ error: true, message: "Error fetching item metrics" });
        }
        res.send({ metrics: results });
    });
});

/* -------------------------
   Daily Item Insert (PROTECTED)
------------------------- */
app.post('/daily-item', (req, res) => {
    const { item_name, quantity_prepared, date } = req.body;

    if (!item_name || !quantity_prepared || !date) {
        return res.status(400).json({ message: "All fields required" });
    }

    dbPool.query(
        "INSERT INTO daily_item_quantity (item_name, quantity_prepared, date) VALUES (?, ?, ?)",
        [item_name, quantity_prepared, date],
        (err, result) => {
            if (err) {
                console.error("Daily item insert error:", err);
                return res.status(500).json({ message: "Database error" });
            }
            res.status(200).json({ message: "Inserted", id: result.insertId });
        }
    );
});

/* -------------------------
   Daily Wastage (PROTECTED)
------------------------- */
app.get('/daily-wastage', (req, res) => {
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ message: "Date is required" });
    }

    const query = `
        SELECT diq.item_name,
               diq.quantity_prepared,
               IFNULL(SUM(o.quantity), 0) AS quantity_ordered,
               (diq.quantity_prepared - IFNULL(SUM(o.quantity), 0)) AS wastage
        FROM daily_item_quantity diq
        LEFT JOIN orders o
               ON diq.item_name = o.item_name
              AND DATE(o.createdAt) = ?
        WHERE diq.date = ?
        GROUP BY diq.item_name, diq.quantity_prepared
    `;

    dbPool.query(query, [date, date], (err, results) => {
        if (err) {
            console.error("Wastage error:", err);
            return res.status(500).json({ message: "DB error" });
        }
        res.status(200).json(results);
    });
});



/* -------------------------
   Menu: Create Item (PROTECTED)
------------------------- */
app.post('/api/menu', upload.single('image'), (req, res) => {
    try {
        const { name, description, price, category, available } = req.body;

        if (!name || !price) {
            return res.status(400).json({ success: false, message: "name and price are required" });
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

        const availableFlag = (available == null || available === "" ? 1 : (available == "0" ? 0 : 1));

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
                image_filename
            ],
            (err, result) => {
                if (err) {
                    console.error("Menu insert error:", err);
                    return res.status(500).json({ success: false, message: "DB insert error" });
                }
                return res.status(201).json({ success: true, data: { id: result.insertId } });
            }
        );
    } catch (err) {
        console.error("POST /api/menu error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

/* -------------------------
   Menu: Get Items (PROTECTED)
------------------------- */
app.get('/api/menu', (req, res) => {
    const { category } = req.query;
    let sql = "SELECT id, name, description, price, category, available FROM menu_items WHERE available = 1";
    const params = [];

    if (category) {
        sql += " AND category = ?";
        params.push(category);
    }

    sql += " ORDER BY id";

    dbPool.query(sql, params, (err, rows) => {
        if (err) {
            console.error("Menu fetch error:", err);
            return res.status(500).json({ success: false, message: "DB error" });
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

/* -------------------------
   Menu Image Fetch (PROTECTED)
------------------------- */
app.get('/api/menu/:id/image', (req, res) => {
    const id = req.params.id;
    const sql = "SELECT image_blob, image_mime FROM menu_items WHERE id = ? LIMIT 1";

    dbPool.query(sql, [id], (err, rows) => {
        if (err) {
            console.error("Menu image error:", err);
            return res.status(500).send("Server error");
        }
        if (!rows || rows.length === 0) return res.status(404).send("Not found");

        const row = rows[0];
        if (!row.image_blob) return res.status(404).send("No image");

        res.setHeader("Content-Type", row.image_mime || "application/octet-stream");
        res.setHeader("Cache-Control", "public, max-age=3600");
        return res.send(row.image_blob);
    });
});

/* -------------------------
   Order Lookup (PROTECTED)
------------------------- */
app.get('/api/order/:orderId', (req, res) => {
    const orderId = req.params.orderId;

    if (!orderId) return res.status(400).json({ success: false, message: "orderId required" });

    const sql = `
        SELECT order_id, user_email, item_name, price, quantity, createdAt
        FROM orders
        WHERE order_id = ?
        ORDER BY createdAt ASC
    `;

    dbPool.query(sql, [orderId], (err, rows) => {
        if (err) {
            console.error("Order lookup error:", err);
            return res.status(500).json({ success: false, message: "DB error" });
        }

        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const order = {
            orderId: rows[0].order_id,
            userEmail: rows[0].user_email,
            createdAt: rows[0].createdAt,
            items: rows.map(r => ({
                itemName: r.item_name,
                price: Number(r.price),
                quantity: Number(r.quantity)
            }))
        };

        order.total = order.items.reduce((s, it) => s + it.price * it.quantity, 0);

        return res.json({ success: true, order });
    });
});

/* -------------------------
   Latest Order Lookup (PROTECTED)
------------------------- */
app.get('/api/orders/latest', (req, res) => {
    const email = req.query.email;

    if (!email) return res.status(400).json({ success: false, message: "email required" });

    const sql = `
        SELECT order_id, MAX(createdAt) AS last_time
        FROM orders
        WHERE user_email = ?
        GROUP BY order_id
        ORDER BY last_time DESC
        LIMIT 1
    `;

    dbPool.query(sql, [email], (err, rows) => {
        if (err) {
            console.error("Latest order ID error:", err);
            return res.status(500).json({ success: false, message: "DB error" });
        }

        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: "No orders for this email" });
        }

        const latestOrderId = rows[0].order_id;

        const sql2 = `
            SELECT order_id, user_email, item_name, price, quantity, createdAt
            FROM orders
            WHERE order_id = ?
            ORDER BY createdAt ASC
        `;

        dbPool.query(sql2, [latestOrderId], (err2, rows2) => {
            if (err2) {
                console.error("Latest order fetch error:", err2);
                return res.status(500).json({ success: false, message: "DB error" });
            }

            if (!rows2 || rows2.length === 0) {
                return res.status(404).json({ success: false, message: "Order not found" });
            }

            const order = {
                orderId: rows2[0].order_id,
                userEmail: rows2[0].user_email,
                createdAt: rows2[0].createdAt,
                items: rows2.map(r => ({
                    itemName: r.item_name,
                    price: Number(r.price),
                    quantity: Number(r.quantity)
                }))
            };

            order.total = order.items.reduce((s, it) => s + it.price * it.quantity, 0);

            return res.json({ success: true, order });
        });
    });
});

/* -------------------------
   Forecast Helpers (PROTECTED)
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
            console.error("Forecast series error:", err);
            return callback(err);
        }

        const series = (rows || []).map(r => ({
            ds: dayjs(r.ds).format("YYYY-MM-DD"),
            y: Number(r.y || 0)
        }));

        callback(null, series);
    });
}

async function callLocalProphetHttp(payload, timeout = 120000) {
    const url = "http://127.0.0.1:5000/forecast";
    const resp = await axios.post(url, payload, { timeout });
    return resp.data;
}

/* -------------------------
   Forecast API (PROTECTED)
------------------------- */
app.get('/api/forecast', (req, res) => {
    let days = Number(req.query.days || 0);

    if (!days) {
        const keys = Object.keys(req.query || {});
        if (keys.length > 0 && /^\d+$/.test(keys[0])) {
            days = Number(keys[0]);
        }
    }

    days = days || Number(process.env.DEFAULT_PREDICTION_LENGTH || 30);

    getDailySeries(async (err, series) => {
        if (err) {
            return res.status(500).json({ error: "DB error building timeseries" });
        }

        if (!series || series.length < 1) {
            return res.status(400).json({ error: "Not enough data", history: series || [] });
        }

        const history = series.slice(-90);
        const past_values = series.map(s => s.y);
        const lastDate = series[series.length - 1].ds;

        // Try Prophet sidecar
        try {
            const payload = {
                past_values,
                past_dates: history.map(h => h.ds),
                predict_length: days,
                last_date: lastDate
            };

            const localResp = await callLocalProphetHttp(payload);

            if (localResp && Array.isArray(localResp.forecast)) {
                return res.json({
                    history: localResp.history || history,
                    forecast: localResp.forecast
                });
            }
        } catch (e) {
            console.error("Prophet error:", e);
        }

        // Fallback local prediction
        const n = Math.min(14, past_values.length);
        const tail = past_values.slice(-n);
        const avg = tail.reduce((a,b)=>a+b,0) / n;

        let slope = 0;
        if (n >= 2) {
            const xMean = (n - 1) / 2;
            const yMean = avg;
            let num = 0, den = 0;

            for (let i = 0; i < n; i++) {
                const x = i;
                num += (x - xMean) * (tail[i] - yMean);
                den += (x - xMean) ** 2;
            }
            slope = den ? num / den : 0;
        }

        let prev = tail[tail.length - 1];
        const forecast = [];

        for (let i = 1; i <= days; i++) {
            const pull = (avg - prev) * 0.08;
            const next = Math.max(0, prev + slope + pull);

            forecast.push({
                ds: dayjs(lastDate).add(i, 'day').format("YYYY-MM-DD"),
                yhat: Number(next)
            });

            prev = next;
        }

        return res.json({ history, forecast });
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
   START SERVER
------------------------- */
app.listen(port, () => {
    console.log(`Secure Server running on http://localhost:${port}`);
});
	
