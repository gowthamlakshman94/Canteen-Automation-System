
```markdown
# Canteen Automation System

The **Canteen Automation System** allows customers to conveniently order food and directly collect it without any waiting time. It eliminates the need to wait in line or for a turn, enhancing the overall experience.

### Features:
- **Sign Up & Login**: Secure user registration and authentication.
- **Menu**: Browse available items.
- **Add to Cart**: Add items to your order.
- **Order Success Page**: Confirmation of order placement.

### Technologies:
- **Frontend**: HTML, CSS, Bootstrap, JavaScript
- **Backend**: PHP
- **Database**: MySQL

---

### Setup Instructions

#### 1. **Run the Website**

To run the Canteen Automation System Website locally, execute the following commands:

```bash
cd ~/Canteen-Automation-System/'Canteen Automation System Website'
nohup python3 -m http.server 80 &

You can also run the website using docker by building the frontend using the dockerfile in path ~/Canteen-Automation-System

docker build -t cas-fe:1 .
# make sure to run it in docker network
docker network create app-network
docker run -d   --name cas-fe   --network app-network  -p 80:80   cas-fe:1
```

#### 2. **Setting up MySQL Database in Docker**

The MySQL database is running in a Docker container. To set it up:

```bash
docker network create app-network
# Running MySQL in Docker on the app-network
docker run -d --name mysql --network app-network -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=canteen_automation mysql:5.7
```

#### 3. **Create the Database and Tables**

Once the MySQL container is running, you need to set up the database and necessary tables. Access the MySQL container and run the following SQL commands:

```bash
# Login to MySQL
mysql -u root -p
# Enter the password specified in MYSQL_ROOT_PASSWORD

# Create the necessary database and tables
CREATE DATABASE IF NOT EXISTS canteen_automation;
USE canteen_automation;

CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quantity INT NOT NULL,
    delivered BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

# Sample data for MYSQl DB

INSERT INTO orders (id, order_id, item_name, price, quantity, delivered, createdAt)
VALUES
(1, 316, 'Mutton Biryani', 170.00, 1, 1, '2024-11-05 11:40:56'),
(2, 316, 'Tangdi Kabab', 160.00, 1, 1, '2024-11-06 11:40:56'),
(3, 1732264282111, 'Veg Pizza', 150.00, 1, 1, '2024-11-07 11:40:56'),
(4, 1732264318389, 'Veg Pizza', 150.00, 1, 0, '2024-11-05 11:40:56'),
(5, 1732264318389, 'Chicken Biryani', 150.00, 1, 0, '2024-11-06 11:40:56'),
(6, 1732264318389, 'Tangdi Kabab', 160.00, 1, 0, '2024-11-07 11:40:56'),
(7, 1732264439389, 'Paneer Tikka', 150.00, 1, 0, '2024-11-05 11:40:56'),
(8, 1732264439389, 'Chicken Biryani', 150.00, 1, 0, '2024-11-06 11:40:56'),
(9, 1732264504221, 'Paneer Tikka', 150.00, 1, 0, '2024-11-07 11:40:56'),
(10, 1732264504221, 'Chicken Biryani', 150.00, 1, 0, '2024-11-05 11:40:56'),
(11, 1732264669645, 'Paneer Tikka', 150.00, 3, 1, '2024-11-06 11:40:56'),
(12, 1732264669645, 'Chicken Biryani', 150.00, 1, 1, '2024-11-25 11:40:56'),
(13, 1732264775254, 'Paneer Tikka', 150.00, 1, 1, '2024-11-25 11:40:56'),
(14, 1732264775254, 'Chicken Biryani', 150.00, 1, 1, '2024-11-25 11:40:56'),
(15, 1732264991126, 'Tea', 10.00, 1, 1, '2024-11-25 11:40:56'),
(16, 1732266538206, 'Chicken Biryani', 150.00, 1, 0, '2024-11-25 11:40:56'),
(17, 1732271326658, 'Mutton Biryani', 170.00, 5, 1, '2024-11-25 11:40:56'),
(18, 1732273825411, 'Roti', 8.00, 15, 0, '2024-11-25 11:40:56'),
(19, 1732273825411, 'Dal Makhani', 150.00, 2, 0, '2024-11-25 11:40:56'),
(20, 1732274289869, 'Maharashtrian Thali', 150.00, 1, 1, '2024-11-25 11:40:56'),
(21, 1732274289869, 'Chicken Shawarma', 70.00, 1, 1, '2024-11-25 11:40:56'),
(22, 1732274825501, 'Chilli Paneer', 120.00, 1, 0, '2024-11-25 11:40:56'),
(23, 1732274825501, 'Paneer Butter Masala', 140.00, 1, 0, '2024-11-25 11:40:56'),
(24, 1732274825501, 'Roti', 8.00, 10, 0, '2024-11-25 11:40:56'),
(25, 1732275420155, 'Manchurian', 90.00, 1, 0, '2024-11-25 11:40:56'),
(26, 1732275420155, 'Veg Pulao', 120.00, 1, 0, '2024-11-25 11:40:56'),
(27, 1732275420155, 'Roti', 8.00, 1, 0, '2024-11-25 11:40:56'),
(28, 1732275420155, 'Garlic Butter Naan', 20.00, 1, 0, '2024-11-25 11:40:56'),
(29, 1732275536723, 'Mutton Biryani', 170.00, 1, 1, '2024-11-25 11:40:56'),
(30, 1732275536723, 'Paneer Butter Masala', 140.00, 1, 1, '2024-11-25 11:40:56'),
(31, 1732275536723, 'Roti', 8.00, 1, 1, '2024-11-25 11:40:56'),
(32, 1732275536723, 'Chicken Shawarma', 70.00, 1, 1, '2024-11-25 11:40:56'),
(33, 1732275536723, 'Paneer Tikka', 150.00, 1, 1, '2024-11-25 11:40:56'),
(34, 1732530990866, 'Veg Pizza', 150.00, 1, 0, '2024-11-25 11:40:56'),
(35, 1732530990866, 'Mutton Biryani', 170.00, 1, 0, '2024-11-25 11:40:56'),
(36, 1732530990866, 'Paneer Butter Masala', 140.00, 1, 0, '2024-11-25 11:40:56'),
(37, 1732530990866, 'Roti', 8.00, 10, 1, '2024-11-25 11:40:56'),
(38, 1732532761011, 'Mutton Biryani', 170.00, 1, 0, '2024-11-25 11:40:56'),
(39, 1732535432412, 'Garlic Butter Naan', 20.00, 1, 1, '2024-11-25 11:50:20'),
(40, 1732536825070, 'Veg Pizza', 150.00, 1, 0, '2024-11-25 12:13:33'),
(41, 1732536895276, 'North Indian Thali', 120.00, 1, 1, '2024-11-25 12:14:43'),
(42, 1732536895276, 'Paneer Tikka', 150.00, 1, 0, '2024-11-25 12:14:43'),
(43, 1732536895276, 'Jeera Rice', 100.00, 1, 0, '2024-11-25 12:14:43'),
(44, 1732536895276, 'Roti', 8.00, 1, 1, '2024-11-25 12:14:43'),
(45, 1732536895276, 'Paneer Butter Masala', 140.00, 1, 1, '2024-11-25 12:14:43'),
(46, 1732542494006, 'Mutton Biryani', 170.00, 1, 0, '2024-11-25 13:48:02'),
(47, 1732542494006, 'Veg Pizza', 150.00, 1, 0, '2024-11-25 13:48:02'),
(48, 1732542494006, 'Maharashtrian Thali', 150.00, 1, 0, '2024-11-25 13:48:02'),
(49, 1732542494006, 'Chicken Shawarma', 70.00, 1, 0, '2024-11-25 13:48:02'),
(50, 1732542494006, 'Tangdi Kabab', 160.00, 1, 0, '2024-11-25 13:48:02');


```

#### 4. **Setting up the Backend**

To build the backend, navigate to the backend directory and build the Docker image:

```bash
cd ~/canteen-automation-backend
docker build -t cas-be:10 .
```

Make sure to run both the backend and MySQL database in the same Docker network. Run the backend with the following command:

```bash
docker run -d --name cas-be --network app-network -p 3000:3000 cas-be:10
```

---

### Notes:
- Ensure the frontend, backend, and database are running in the same Docker network (`app-network`) to allow seamless communication between them.
- You can customize database credentials and configurations by modifying the Docker run commands.

Feel free to open an issue if you encounter any problems, or contribute to the project by submitting a pull request!

---

### License:
[MIT License](LICENSE)
```

### Changes made:
- Improved formatting for readability.
- Added headers to clearly separate sections.
- Specified `Notes` and `License` sections for clarity and extensibility.
- Corrected some minor formatting issues for consistency (e.g., code blocks and command usage).
