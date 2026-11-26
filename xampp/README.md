# Deploying on XAMPP (Apache + MySQL + PHP)

This project includes a complete PHP + MySQL backend (`xampp/api/`) and MySQL schema (`xampp/database.sql`) so you can host the application directly on XAMPP.

## 1. Start Apache & MySQL in XAMPP
Open the **XAMPP Control Panel** and start **Apache** and **MySQL**.

## 2. Import the MySQL Database
1. Open `http://localhost/phpmyadmin`.
2. Click **Import** (or **SQL**) and select `xampp/database.sql`.
3. Click **Go** — this creates the `odm_db` database and all tables (`employees`, `vehicles`, `projects`, `mission_orders`, `app_settings`, `order_sequences`).

> **Custom MySQL credentials:** By default, `api/config.php` connects as `root` with an empty password on `127.0.0.1:3306`. To customize this, create `api/config.local.php`:
> ```php
> <?php
> return [
>   'ODM_DB_HOST' => '127.0.0.1',
>   'ODM_DB_NAME' => 'odm_db',
>   'ODM_DB_USER' => 'root',
>   'ODM_DB_PASS' => 'your_mysql_password',
> ];
> ```

## 3. Build & Copy to `htdocs`
Run the build command from the project root:
```bash
npm run build:xampp
```
This creates a ready-to-deploy `xampp-dist/` folder containing the built frontend (`index.html`, `assets/`, `LOGO_OPTISERVE_NEW.jpg`), `.htaccess`, `database.sql`, and `api/`.

Copy the contents of `xampp-dist/` into your XAMPP web root:
- **Windows:** `C:\xampp\htdocs\odm\`
- **macOS:** `/Applications/XAMPP/htdocs/odm/`
- **Linux:** `/opt/lampp/htdocs/odm/`

## 4. Open & Set Up Admin Password
Open `http://localhost/odm/` in your browser.
On first launch, you will be prompted to create your `admin` password, which is hashed with bcrypt and stored in MySQL (`app_settings`).
