# QR-Based College Parking Management System

A smart college parking system where students/staff register their vehicles and
receive a unique **QR code**. Security personnel scan the QR at the parking gate
to verify the vehicle, assign a free slot automatically, and record entry/exit —
all in real time.

![Stack](https://img.shields.io/badge/Backend-Flask-blue)
![Stack](https://img.shields.io/badge/Database-SQLite-green)
![Stack](https://img.shields.io/badge/Frontend-HTML%20%2F%20CSS%20%2F%20JS-orange)

---

## Features

- 🚗 **Vehicle Registration** — students/staff register name, college ID, email,
  vehicle number and type (Bike / Car).
- 🔒 **Unique QR Code** — each vehicle gets a unique UUID token; the QR contains
  only a safe verify URL (no personal data embedded inside).
- 📷 **Camera QR Scanner** — security scans codes with the device camera
  (`html5-qrcode`), with a manual token fallback.
- ✅ **QR Verification** — instantly shows owner, college ID, vehicle number,
  type, and current parking status.
- 🅿️ **Automatic Slot Assignment** — the first free slot (A01 → B10) is assigned
  on entry; slot changes `FREE → OCCUPIED`.
- 🚪 **Vehicle Exit** — one click releases the slot and changes
  `OCCUPIED → FREE`, closing the parking record.
- 🚫 **Duplicate Entry Prevention** — a vehicle already parked cannot be given
  another slot.
- 🛑 **Parking Full Handling** — when all 20 slots are occupied, entry is
  gracefully blocked.
- 📊 **Live Dashboard** — total / free / occupied counters and a visual parking
  grid, auto-refreshed every 5 seconds via lightweight AJAX polling
  (`/api/slots`).
- 🔐 **Admin Panel** — statistics, currently parked vehicles with **EXIT**
  buttons, parking history with search.
- 🕘 **Parking History** — full entry/exit log, searchable by vehicle number.
- 🛡️ **Secure by Default** — hashed admin password, parameterized SQL queries,
  server-side validation, no stack traces shown to users.

---

## Installation

### 1. Create a virtual environment

```bash
python3 -m venv venv
source venv/bin/activate
```

> On Windows: `venv\Scripts\activate`

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the application

```bash
python app.py
```

### 4. Open the app

```
http://127.0.0.1:5000
```

---

## Admin Login

| Username | Password   |
| -------- | ---------- |
| `admin`  | `admin123` |

> The password is **hashed** (via `werkzeug.security`) and stored in SQLite.
> The default admin is created automatically on first run.

---

## Project Architecture

```
Frontend (HTML + CSS + JS)
        │
        ▼
   Flask (Python)
        │
        ▼
   SQLite (parking.db)
```

- **Frontend** — Jinja2 templates, modern CSS, and `html5-qrcode` for camera
  scanning. The dashboard polls `/api/slots` every 5 seconds (no WebSockets).
- **Backend** — Flask routes handle registration, verification, entry/exit and
  admin actions. All state-changing operations use **POST** requests.
- **Database** — a single SQLite file (`parking.db`) stores users, vehicles,
  parking slots and parking records.

---

## Database Structure

### `users`

| Column      | Type    | Notes               |
| ----------- | ------- | ------------------- |
| id          | INTEGER | PK, auto-increment  |
| name        | TEXT    | Owner name          |
| college_id  | TEXT    | UNIQUE              |
| email       | TEXT    |                     |
| created_at  | TEXT    | Timestamp           |

### `vehicles`

| Column         | Type    | Notes               |
| -------------- | ------- | ------------------- |
| id             | INTEGER | PK, auto-increment  |
| user_id        | INTEGER | FK → users.id       |
| vehicle_number | TEXT    | UNIQUE              |
| vehicle_type   | TEXT    | Bike / Car          |
| qr_token       | TEXT    | UNIQUE, UUID        |
| created_at     | TEXT    | Timestamp           |

### `parking_slots`

| Column      | Type    | Notes                    |
| ----------- | ------- | ------------------------ |
| id          | INTEGER | PK, auto-increment       |
| slot_number | TEXT    | UNIQUE (A01 … B10)       |
| status      | TEXT    | `FREE` or `OCCUPIED`     |
| vehicle_id  | INTEGER | FK → vehicles.id (or NULL) |

> 20 slots are seeded automatically: **A01–A10** and **B01–B10**, all `FREE`.

### `parking_records`

| Column     | Type    | Notes                    |
| ---------- | ------- | ------------------------ |
| id         | INTEGER | PK, auto-increment       |
| vehicle_id | INTEGER | FK → vehicles.id         |
| slot_id    | INTEGER | FK → parking_slots.id    |
| entry_time | TEXT    | Timestamp                |
| exit_time  | TEXT    | NULL while parked        |
| status     | TEXT    | `PARKED` or `EXITED`     |

### `admin_users`

| Column        | Type    | Notes                   |
| ------------- | ------- | ----------------------- |
| id            | INTEGER | PK, auto-increment      |
| username      | TEXT    | UNIQUE (default: admin) |
| password_hash | TEXT    | Hashed password         |

---

## How QR Parking Works

```
Registration
     │
     ▼
QR Generation
     │
     ▼
QR Scan (camera)
     │
     ▼
Verification
     │
     ▼
Slot Assignment (first FREE slot)
     │
     ▼
FREE ──────────────► OCCUPIED
     │
     ▼
Vehicle Exit
     │
     ▼
OCCUPIED ───────────► FREE
```

### Demo Flow

1. **Student** opens `/register` and registers:
   - Name: `AJ` • College ID: `23CSE001` • Vehicle: `TN38AB1234` • Type: `Bike`
2. **System** generates a unique QR code (saved in `static/qr/`).
3. **Security** opens `/scan` and points the camera at the QR.
4. **System** shows `VALID QR` with owner, vehicle, and the available slot.
5. **Security** clicks **ALLOW ENTRY** → the slot becomes `OCCUPIED` and an
   entry record is created.
6. **Dashboard** updates in real time: `Free: 19`, `Occupied: 1`.
7. When the vehicle leaves, **Security** clicks **EXIT** → the slot becomes
   `FREE` again.

---

## Key Flask Routes

| Route                  | Method   | Description                            |
| ---------------------- | -------- | -------------------------------------- |
| `/`                    | GET      | Landing page                           |
| `/register`            | GET/POST | Vehicle registration                   |
| `/qr/<vehicle_id>`     | GET      | Show generated QR code                 |
| `/verify/<token>`      | GET      | Public QR verification page            |
| `/login` `/logout`     | GET/POST | Admin authentication                  |
| `/dashboard`           | GET      | Public live parking map                |
| `/admin`               | GET      | Admin dashboard (login required)       |
| `/scan`                | GET      | Camera QR scanner (login required)     |
| `/entry/<vehicle_id>`  | POST     | Allow entry + assign slot (login req.) |
| `/exit/<vehicle_id>`   | POST     | Release slot + close record (login req.)|
| `/history`             | GET      | Parking history with search (login)    |
| `/api/slots`           | GET      | JSON slot data for AJAX polling        |
| `/api/vehicle/<id>`    | GET      | JSON status of a single vehicle        |

---

## Project Structure

```
qr-parking-system/
│
├── app.py
├── requirements.txt
├── parking.db            (created automatically)
├── README.md
│
├── templates/
│   ├── base.html
│   ├── index.html
│   ├── register.html
│   ├── qr.html
│   ├── login.html
│   ├── dashboard.html
│   ├── vehicle.html
│   ├── scan.html
│   ├── admin.html
│   ├── admin_base.html
│   ├── history.html
│   └── error.html
│
└── static/
    ├── css/
    │   └── style.css
    ├── js/
    │   └── scanner.js
    └── qr/               (generated QR images)
```

---

## Notes for the Demo

- The QR scanner needs **camera access** — use a phone or a laptop with a webcam
  on `http://127.0.0.1:5000/scan`.
- If no camera is available, paste the QR token manually on the scanner page.
- The dashboard updates every **5 seconds** using AJAX polling — refresh the
  page anytime for an instant manual update.

---

*Made as a college mini-project. Python + Flask + SQLite + QR.*

