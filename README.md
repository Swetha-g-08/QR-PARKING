# QR-Based College Parking Management System (CampusPark)

A production-ready, full-stack college parking management platform. Students and staff register their vehicles to receive a unique **QR code pass**. Security personnel scan the QR pass at campus gates to verify identity, automatically allocate available parking bays (`A01`–`B10`), and record vehicle entry/exit in real time.

![Stack](https://img.shields.io/badge/Production-Vercel-black?logo=vercel)
![Stack](https://img.shields.io/badge/Backend-Flask-blue?logo=flask)
![Stack](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-emerald?logo=supabase)
![Stack](https://img.shields.io/badge/Local%20DB-SQLite-green?logo=sqlite)
![Stack](https://img.shields.io/badge/Frontend-HTML5%20%2F%20TailwindCSS%20%2F%20JS-orange)

---

## 🚀 Live Demo

- **Vercel Production Deployment**: [https://qr-parking-eta.vercel.app](https://qr-parking-eta.vercel.app)
- **Database**: Supabase Transaction Pooler (PostgreSQL)

---

## ✨ Features

- 🚗 **Vehicle Registration** — Register student/faculty name, college ID, email, vehicle plate number, and type (Car / Bike).
- 🔒 **Environment-Aware QR Generation** — Dynamically bakes production domain (`https://qr-parking-eta.vercel.app/verify/<token>`) or local network IP for seamless mobile phone camera scanning.
- 🅿️ **Automated Slot Allocation** — Scanning a QR pass automatically assigns the nearest available parking bay (`A01` → `B10`) via atomic database updates (`FREE` → `OCCUPIED`).
- 🛡️ **Double Allocation Prevention** — Prevents active parked vehicles from being assigned duplicate parking spots.
- 🚪 **One-Touch Vehicle Exit** — Security personnel can check out vehicles, closing entry logs and marking slots as `FREE`.
- 📊 **Real-Time Interactive Dashboard** — Live floor map with slot availability metrics and automatic AJAX polling (`/api/slots`).
- 🔄 **Admin Reset Parking Data** — Admin-only Danger Zone feature to clear daily parking logs and reset slots to `FREE` while preserving registered users, vehicles, and admin credentials.
- 📷 **Webcam & Mobile QR Scanner** — Real-time camera scanning via `html5-qrcode` with manual token fallback.
- 📱 **Apple/iOS-Style Native Emoji Fallbacks** — Cross-platform `.emoji` font stack combined with Google Material Symbols vector icons.

---

## 🔐 Admin Login Credentials

| Username | Password |
| :--- | :--- |
| `admin` | `admin123` |

> *Admin passwords are securely hashed using `werkzeug.security`.*

---

## 🛠️ Tech Stack & Architecture

```text
       Mobile / Desktop Browser
                  │
                  ▼
         Vercel Serverless (Flask)
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
Supabase PostgreSQL   SQLite (Local Dev)
 (Production Pooler)     (parking.db)
```

- **Backend**: Python 3.12, Flask, Gunicorn, `psycopg2-binary`, `python-dotenv`.
- **Database Abstraction (`UnifiedDB`)**: Unified SQL wrapper supporting both PostgreSQL and SQLite. Handles placeholder translation (`?` ↔ `%s`) and row mapping.
- **Frontend**: Jinja2 Templates, Tailwind CSS, Google Material Symbols, HTML5 Camera API.

---

## 💻 Local Development Setup

### 1. Clone the repository
```bash
git clone https://github.com/Swetha-g-08/QR-PARKING.git
cd QR-PARKING
```

### 2. Create and activate a virtual environment
```bash
python3 -m venv venv
source venv/bin/activate
```
*(On Windows: `venv\Scripts\activate`)*

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables (`.env`)
Create a `.env` file in the project root:
```env
BASE_URL="http://127.0.0.1:5000"
SECRET_KEY="campuspark-local-secret-key"
# Optional: Set DATABASE_URL to connect to Supabase PostgreSQL locally
# DATABASE_URL="postgresql://user:pass@host:6543/postgres"
```

### 5. Run the application
```bash
python app.py
```
Open [http://127.0.0.1:5000](http://127.0.0.1:5000) in your browser.

---

## 📂 Database Schema

The database consists of 5 core tables:

### `users`
- `id` (PK, Serial/Integer)
- `name` (Text)
- `college_id` (Text, Unique)
- `email` (Text)
- `created_at` (Timestamp)

### `vehicles`
- `id` (PK, Serial/Integer)
- `user_id` (FK → `users.id`)
- `vehicle_number` (Text, Unique)
- `vehicle_type` (Text: `Car` or `Bike`)
- `qr_token` (Text, Unique UUID)
- `created_at` (Timestamp)

### `parking_slots`
- `id` (PK, Serial/Integer)
- `slot_number` (Text, Unique: `A01`–`B10`)
- `status` (Text: `FREE` or `OCCUPIED`)
- `vehicle_id` (FK → `vehicles.id`, Nullable)

### `parking_records`
- `id` (PK, Serial/Integer)
- `vehicle_id` (FK → `vehicles.id`)
- `slot_id` (FK → `parking_slots.id`)
- `entry_time` (Timestamp)
- `exit_time` (Timestamp, Nullable)
- `status` (Text: `PARKED` or `EXITED`)

### `admin_users`
- `id` (PK, Serial/Integer)
- `username` (Text, Unique)
- `password_hash` (Text)

---

## ⚡ Key API & Flask Routes

| Route | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/` | `GET` | Public | Landing page & feature showcase |
| `/register` | `GET/POST` | Public | Register vehicle & generate QR pass |
| `/qr/<vehicle_id>` | `GET` | Public | View vehicle QR pass |
| `/verify/<token>` | `GET` | Public | QR scan landing route & auto-slot allocation |
| `/dashboard` | `GET` | Public | Interactive parking floor map & live counters |
| `/login` / `/logout` | `GET/POST` | Public | Admin authentication |
| `/admin` | `GET` | Admin | Security console & Danger Zone controls |
| `/admin/reset-parking` | `POST` | Admin | Atomic transaction to reset slots & history |
| `/scan` | `GET` | Admin | Webcam QR scanner page |
| `/exit/<vehicle_id>` | `POST` | Admin | Release parking slot & record checkout |
| `/history` | `GET` | Admin | Complete searchable parking history logs |
| `/api/slots` | `GET` | Public | Lightweight JSON endpoint for slot map polling |

---

## 🌐 Deployment to Vercel

1. Push your repository to GitHub.
2. Import the project in the [Vercel Dashboard](https://vercel.com).
3. Configure the following **Environment Variables**:
   - `BASE_URL`: `https://qr-parking-eta.vercel.app`
   - `DATABASE_URL`: `postgresql://<user>:<password>@<pooler-host>:6543/postgres`
   - `SECRET_KEY`: `<your-random-secret-key>`
4. Deploy! Vercel uses `api/index.py` and `vercel.json` to run the serverless Flask app.

---

## 📜 License & Acknowledgments

Built for Smart Campus Mobility & QR-Based College Parking Systems.
Powered by Python, Flask, Supabase PostgreSQL, and Vercel.
