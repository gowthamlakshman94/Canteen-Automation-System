
const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = 3000;
const bcrypt = require('bcrypt');

// Add near top with other requires
const multer = require('multer');

// Multer memory storage so we can store Buffer into MySQL BLOB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB max; adjust as needed
});


// Middleware
app.use(bodyParser.json());
app.use(cors()); // Enable CORS for all domains (or restrict it to your frontend domain if needed)

// MySQL Connection Pool Setup
const dbPool = mysql.createPool({
  connectionLimit: 10,  // Pool size, adjust based on your usage
  host: 'mysql',  // Replace with your MySQL hostname if needed
  user: 'root',  // Replace with your MySQL username
  password: 'password',  // Replace with your MySQL password
  database: 'canteen_automation',  // Replace with your database name
  waitForConnections: true,
  queueLimit: 0,  // No limit for pending connections
  connectTimeout: 10000,  // 10 seconds for a connection attempt
});

// Function to check MySQL connection and reconnect if lost
function handleDBConnection() {
  dbPool.getConnection((err, connection) => {
    if (err) {
      console.error('Database connection failed:', err.stack);
      setTimeout(handleDBConnection, 5000);  // Retry after 5 seconds
    } else {
      console.log('Connected to MySQL database.');
      connection.release();  // Release the connection after checking
    }
  });
}

// Ensure that the MySQL connection is healthy at the start
handleDBConnection();


app.post('/submitOrder', (req, res) => {
    const { orderId, userEmail, items } = req.body;

    // Generate current timestamp in 'YYYY-MM-DD HH:MM:SS' format
    const createdAt = new Date().toISOString().slice(0, 19).replace("T", " ");

    // Basic validation
    if (!orderId || !userEmail || !items || !Array.isArray(items)) {
        return res.status(400).send({ message: 'Invalid order data' });
    }

    // Prepare values for bulk insert
    const values = items.map(item => [
        orderId,
        userEmail,
        item.itemName,
        item.price,
        item.quantity,
        item.delivered ? 1 : 0,
        createdAt
    ]);

    // Updated SQL to include user_email
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
    });
});


// API to fetch orders
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

// Update delivery status for a specific item in an order
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

  dbPool.query(query, (err, result) => {
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


// Route to handle data insertion
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

// API to fetch wastage report
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
      Spring: [3, 4, 5],  // March, April, May
      Summer: [6, 7, 8],  // June, July, August
      Autumn: [9, 10, 11], // September, October, November
      Winter: [12, 1, 2],  // December, January, February
    };

    const currentMonth = new Date().getMonth() + 1; // Get current month (1-indexed)
    const seasonNames = Object.keys(seasons);

    // Determine the current season and last three seasons
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

      // Aggregate the data for each season
      const aggregatedData = filteredData.reduce((seasonAcc, item) => {
        seasonAcc[item.item_name] = (seasonAcc[item.item_name] || 0) + item.total_quantity;
        return seasonAcc;
      }, {});

      // Sort items by total quantity
      const sortedItems = Object.entries(aggregatedData).sort(([, a], [, b]) => b - a);

      // Store the top 5 and bottom 5 items for the season
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

// Endpoint to check order by orderId
app.get('/checkOrder/:orderId', (req, res) => {
    const orderId = req.params.orderId;

    // Query to check if the order exists in the database
    const query = 'SELECT * FROM orders WHERE order_id = ?';

    dbPool.query(query, [orderId], (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (results.length > 0) {
            // Order exists
            res.json({ exists: true });
        } else {
            // Order does not exist
            res.json({ exists: false });
        }
    });
});

/********************************************************
 * Menu endpoints for menu_addition.html
 * - POST /api/menu           : accepts multipart/form-data (image) and stores into DB (image_blob + image_mime)
 * - GET  /api/menu           : returns menu items metadata (image_url points to next endpoint)
 * - GET  /api/menu/:id/image : serves image blob with proper Content-Type
 ********************************************************/

// NOTE: ensure your `menu_items` table has image_blob LONGBLOB and image_mime VARCHAR column.
// If not present, run:
// ALTER TABLE menu_items ADD COLUMN image_blob LONGBLOB;
// ALTER TABLE menu_items ADD COLUMN image_mime VARCHAR(100);

// POST /api/menu -> receive form data and image file
// Expects multipart/form-data with fields: name, description, price, category, available and image file field named 'image'

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
      image_blob = req.file.buffer;          // Buffer
      image_mime = req.file.mimetype;        // e.g., image/jpeg
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

// GET /api/menu -> list menu items (no blob in response)
// supports optional ?category=Breakfast|Lunch|Dinner
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
    // Add image_url that frontend will use to fetch the image blob
    const host = req.protocol + '://' + req.get('host');
    const items = rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      price: parseFloat(r.price),
      category: r.category,
      available: r.available,
      image_url: `/api/menu/${r.id}/image` // relative path; frontend can prepend API_BASE if required
    }));
    res.json({ success: true, data: items });
  });
});

// GET /api/menu/:id/image -> serve image blob with correct content-type
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
    // optional caching:
    res.setHeader('Cache-Control', 'public, max-age=3600');
    // send buffer
    return res.send(row.image_blob);
  });
});


// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

