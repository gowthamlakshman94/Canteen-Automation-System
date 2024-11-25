
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
