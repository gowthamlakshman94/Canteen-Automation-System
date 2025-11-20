
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

# Make sure to run this script to replace the localhost names into api_urls. This should be done if your host your app in any cloud VM. Mostly it should be a load balancer IP or the public url of the VM

sh ~/Canteen-Automation-System/'Canteen Automation System Website'/replace_localhost.sh

docker build -t cas-fe:1 .
# make sure to run it in docker network
docker network create app-network
docker run -d  -e BASE_URL="http://your.api.url"  --name cas-fe   --network app-network  -p 80:80   cas-fe:1
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
    user_email VARCHAR(255) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quantity INT NOT NULL,
    delivered BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE daily_item_quantity (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_name VARCHAR(255) NOT NULL,
    quantity_prepared INT NOT NULL,
    date DATE NOT NULL
);


# Sample data for MYSQl DB

INSERT INTO orders (id, order_id, user_email, item_name, price, quantity, delivered, createdAt)
VALUES
(1, 316, 'default_email@email.com', 'Mutton Biryani', 170.00, 1, 1, '2024-11-05 11:40:56'),
(2, 316, 'default_email@email.com', 'Tangdi Kabab', 160.00, 1, 1, '2024-11-06 11:40:56'),
(3, 1732264282111, 'default_email@email.com', 'Veg Pizza', 150.00, 1, 1, '2024-11-07 11:40:56'),
(4, 1732264318389, 'default_email@email.com', 'Veg Pizza', 150.00, 1, 0, '2024-11-05 11:40:56'),
(5, 1732264318389, 'default_email@email.com', 'Chicken Biryani', 150.00, 1, 0, '2024-11-06 11:40:56'),
(6, 1732264318389, 'default_email@email.com', 'Tangdi Kabab', 160.00, 1, 0, '2024-11-07 11:40:56'),
(7, 1732264439389, 'default_email@email.com', 'Paneer Tikka', 150.00, 1, 0, '2024-11-05 11:40:56'),
(8, 1732264439389, 'default_email@email.com', 'Chicken Biryani', 150.00, 1, 0, '2024-11-06 11:40:56'),
(9, 1732264504221, 'default_email@email.com', 'Paneer Tikka', 150.00, 1, 0, '2024-11-07 11:40:56'),
(10, 1732264504221, 'default_email@email.com', 'Chicken Biryani', 150.00, 1, 0, '2024-11-05 11:40:56'),
(11, 1732264669645, 'default_email@email.com', 'Paneer Tikka', 150.00, 3, 1, '2024-11-06 11:40:56'),
(12, 1732264669645, 'default_email@email.com', 'Chicken Biryani', 150.00, 1, 1, '2024-11-25 11:40:56'),
(13, 1732264775254, 'default_email@email.com', 'Paneer Tikka', 150.00, 1, 1, '2024-11-25 11:40:56'),
(14, 1732264775254, 'default_email@email.com', 'Chicken Biryani', 150.00, 1, 1, '2024-11-25 11:40:56'),
(15, 1732264991126, 'default_email@email.com', 'Tea', 10.00, 1, 1, '2024-11-25 11:40:56'),
(16, 1732266538206, 'default_email@email.com', 'Chicken Biryani', 150.00, 1, 0, '2024-11-25 11:40:56'),
(17, 1732271326658, 'default_email@email.com', 'Mutton Biryani', 170.00, 5, 1, '2024-11-25 11:40:56'),
(18, 1732273825411, 'default_email@email.com', 'Roti', 8.00, 15, 0, '2024-11-25 11:40:56'),
(19, 1732273825411, 'default_email@email.com', 'Dal Makhani', 150.00, 2, 0, '2024-11-25 11:40:56'),
(20, 1732274289869, 'default_email@email.com', 'Maharashtrian Thali', 150.00, 1, 1, '2024-11-25 11:40:56'),
(21, 1732274289869, 'default_email@email.com', 'Chicken Shawarma', 70.00, 1, 1, '2024-11-25 11:40:56'),
(22, 1732274825501, 'default_email@email.com', 'Chilli Paneer', 120.00, 1, 0, '2024-11-25 11:40:56'),
(23, 1732274825501, 'default_email@email.com', 'Paneer Butter Masala', 140.00, 1, 0, '2024-11-25 11:40:56'),
(24, 1732274825501, 'default_email@email.com', 'Roti', 8.00, 10, 0, '2024-11-25 11:40:56'),
(25, 1732275420155, 'default_email@email.com', 'Manchurian', 90.00, 1, 0, '2024-11-25 11:40:56'),
(26, 1732275420155, 'default_email@email.com', 'Veg Pulao', 120.00, 1, 0, '2024-11-25 11:40:56'),
(27, 1732275420155, 'default_email@email.com', 'Roti', 8.00, 1, 0, '2024-11-25 11:40:56'),
(28, 1732275420155, 'default_email@email.com', 'Garlic Butter Naan', 20.00, 1, 0, '2024-11-25 11:40:56'),
(29, 1732275536723, 'default_email@email.com', 'Mutton Biryani', 170.00, 1, 1, '2024-11-25 11:40:56'),
(30, 1732275536723, 'default_email@email.com', 'Paneer Butter Masala', 140.00, 1, 1, '2024-11-25 11:40:56'),
(31, 1732275536723, 'default_email@email.com', 'Roti', 8.00, 1, 1, '2024-11-25 11:40:56'),
(32, 1732275536723, 'default_email@email.com', 'Chicken Shawarma', 70.00, 1, 1, '2024-11-25 11:40:56'),
(33, 1732275536723, 'default_email@email.com', 'Paneer Tikka', 150.00, 1, 1, '2024-11-25 11:40:56'),
(34, 1732530990866, 'default_email@email.com', 'Veg Pizza', 150.00, 1, 0, '2024-11-25 11:40:56'),
(35, 1732530990866, 'default_email@email.com', 'Mutton Biryani', 170.00, 1, 0, '2024-11-25 11:40:56'),
(36, 1732530990866, 'default_email@email.com', 'Paneer Butter Masala', 140.00, 1, 0, '2024-11-25 11:40:56'),
(37, 1732530990866, 'default_email@email.com', 'Roti', 8.00, 10, 1, '2024-11-25 11:40:56'),
(38, 1732532761011, 'default_email@email.com', 'Mutton Biryani', 170.00, 1, 0, '2024-11-25 11:40:56'),
(39, 1732535432412, 'default_email@email.com', 'Garlic Butter Naan', 20.00, 1, 1, '2024-11-25 11:50:20'),
(40, 1732536825070, 'default_email@email.com', 'Veg Pizza', 150.00, 1, 0, '2024-11-25 12:13:33'),
(41, 1732536895276, 'default_email@email.com', 'North Indian Thali', 120.00, 1, 1, '2024-11-25 12:14:43'),
(42, 1732536895276, 'default_email@email.com', 'Paneer Tikka', 150.00, 1, 0, '2024-11-25 12:14:43'),
(43, 1732536895276, 'default_email@email.com', 'Jeera Rice', 100.00, 1, 0, '2024-11-25 12:14:43'),
(44, 1732536895276, 'default_email@email.com', 'Roti', 8.00, 1, 1, '2024-11-25 12:14:43'),
(45, 1732536895276, 'default_email@email.com', 'Paneer Butter Masala', 140.00, 1, 1, '2024-11-25 12:14:43'),
(46, 1732542494006, 'default_email@email.com', 'Mutton Biryani', 170.00, 1, 0, '2024-11-25 13:48:02'),
(47, 1732542494006, 'default_email@email.com', 'Veg Pizza', 150.00, 1, 0, '2024-11-25 13:48:02'),
(48, 1732542494006, 'default_email@email.com', 'Maharashtrian Thali', 150.00, 1, 0, '2024-11-25 13:48:02'),
(49, 1732542494006, 'default_email@email.com', 'Chicken Shawarma', 70.00, 1, 0, '2024-11-25 13:48:02'),
(50, 1732542494006, 'default_email@email.com', 'Tangdi Kabab', 160.00, 1, 0, '2024-11-25 13:48:02');


# user data table

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    contact VARCHAR(15) NOT NULL,
    city VARCHAR(50) NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

To run the application in kubernetes, please use the k8s_deployment.yaml file

```bash
kubectl apply -f k8s_deployment.yaml
```


---

### Notes:
- Ensure the frontend, backend, and database are running in the same Docker network (`app-network`) to allow seamless communication between them.
- You can customize database credentials and configurations by modifying the Docker run commands.
- Users can access the admin console of the app using the url http://<your_url>/admin.html

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

```
### Network ports to be opened
80/TCP --> Inbound/Outbound
443/TCP --> Inbound/Outbound
3000/TCP --> Inbound




# 📦 Install Jenkins on Kubernetes (K3s + Traefik Ingress)



This guide explains how to install **Jenkins** inside a Kubernetes cluster using **Helm**, configure persistent storage, and expose Jenkins through the **Traefik Ingress** included with K3s.

This setup is ideal for learning CI/CD and demonstrating concepts — not for production.

---

# ✅ Prerequisites

* Kubernetes cluster running (ex: **K3s**)
* Traefik ingress controller (built-in in K3s)
* Helm installed:

  ```bash
  helm version
  ```
* kubectl configured:

  ```bash
  kubectl get nodes
  ```

---

# 🚀 1. Install Jenkins with Helm (Simple Academic Setup)

Use this command exactly:

```bash
helm install jenkins jenkins/jenkins -n jenkins \
  --create-namespace \
  --set controller.admin.username=admin \
  --set controller.admin.password=admin123 \
  --set persistence.storageClass=local-path \
  --set persistence.size=10Gi
```

✔ Creates namespace
✔ Installs Jenkins
✔ Sets simple username + password
✔ Uses K3s `local-path` StorageClass
✔ Adds 10Gi PVC for Jenkins home

---

# 📌 2. Wait for Jenkins to be ready

```bash
kubectl get pods -n jenkins
kubectl get svc -n jenkins
```

When the pod shows:

```
jenkins-xxxxx   Running
```

you are ready to expose it.

---

# 🌐 3. Create Traefik Ingress for Jenkins

Create a file named:

`jenkins-ingress.yaml`

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: jenkins-ingress
  namespace: jenkins
  annotations:
    kubernetes.io/ingress.class: traefik
spec:
  rules:
    - host: jenkins.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: jenkins
                port:
                  number: 8080
```

Apply it:

```bash
kubectl apply -f jenkins-ingress.yaml
kubectl get ingress -n jenkins
```

Expected:

```
jenkins.local   <traefik-ip>   80
```

---

# 💻 4. Access Jenkins from Browser

## Step 1 → Get your WSL or cluster IP

(For Windows + WSL2)

```bash
hostname -I
```

Example:

```
172.22.176.1
```

## Step 2 → Add hosts entry

### Windows (Run Notepad as Administrator)

Edit:

```
C:\Windows\System32\drivers\etc\hosts
```

Add a line:

```
172.22.176.1   jenkins.local
```

## Step 3 → Open Jenkins

```
http://jenkins.local
```

---

# 🔑 5. Login Credentials

Since we set them during installation:

```
Username: admin
Password: admin123
```

---

# 🧪 6. (Optional) Quick Port-Forward Method

If you don't want to configure ingress:

```bash
kubectl port-forward svc/jenkins -n jenkins 8080:8080
```

Then open:

```
http://localhost:8080
```

---

# 🛠 7. Uninstall Jenkins

```bash
helm uninstall jenkins -n jenkins
kubectl delete namespace jenkins
```

---

# 📝 Notes

* This setup is **not for production** (default passwords, no TLS, no RBAC hardening).
* Perfect for **MTech/CSE semester projects**, demonstrations, CI/CD learning.
* Works beautifully with a local K3s cluster and Jenkins pipelines.

---

