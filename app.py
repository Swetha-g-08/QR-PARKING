"""
QR-Based College Parking Management System
==========================================
A smart college parking system where students/staff register their vehicles
and receive a unique QR code. Security personnel scan the QR at the entrance
to verify, assign a free slot, and record entry/exit.

Tech stack: Flask + SQLite + Jinja2 + qrcode + html5-qrcode (JS)

Run with:
    python app.py
Then open:  http://127.0.0.1:5000
"""

import os
import socket
import sqlite3
import uuid
from datetime import datetime

from flask import (
    Flask,
    abort,
    flash,
    g,
    has_request_context,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash
import qrcode

# ---------------------------------------------------------------------------
# App configuration
# ---------------------------------------------------------------------------
IS_VERCEL = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
if IS_VERCEL:
    DATA_DIR = "/tmp"
    QR_FOLDER = os.path.join("/tmp", "qr")
else:
    DATA_DIR = os.path.dirname(os.path.abspath(__file__))
    QR_FOLDER = os.path.join(DATA_DIR, "static", "qr")

DATABASE = os.path.join(DATA_DIR, "parking.db")

app = Flask(__name__)
# A random secret key keeps Flask sessions safe. In production use a real secret.
app.secret_key = os.environ.get("SECRET_KEY", "college-parking-demo-secret")
app.config["DATABASE"] = DATABASE
app.config["QR_FOLDER"] = QR_FOLDER

# Make sure the QR image folder exists.
os.makedirs(QR_FOLDER, exist_ok=True)

_DB_INITIALIZED = False

DATABASE_URL = os.environ.get("DATABASE_URL")

class UnifiedCursor:
    def __init__(self, cursor, is_postgres=False):
        self.cursor = cursor
        self.is_postgres = is_postgres
        self.lastrowid = getattr(cursor, "lastrowid", None)

    def fetchone(self):
        return self.cursor.fetchone()

    def fetchall(self):
        return self.cursor.fetchall()

    def __getitem__(self, item):
        return self.cursor[item]


class UnifiedDB:
    def __init__(self, db_url=None, sqlite_path=None):
        self.db_url = db_url
        self.sqlite_path = sqlite_path
        self.is_postgres = bool(db_url)
        if self.is_postgres:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            url = db_url
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql://", 1)
            self.conn = psycopg2.connect(url, cursor_factory=RealDictCursor)
        else:
            self.conn = sqlite3.connect(sqlite_path)
            self.conn.row_factory = sqlite3.Row
            self.conn.execute("PRAGMA foreign_keys = ON")

    def execute(self, query, params=()):
        cursor = self.conn.cursor()
        sql = query
        if self.is_postgres:
            sql = sql.replace("?", "%s")
            is_insert = sql.strip().upper().startswith("INSERT")
            has_returning = "RETURNING" in sql.upper()
            if is_insert and not has_returning:
                sql += " RETURNING id"
                cursor.execute(sql, params)
                inserted_id = cursor.fetchone()
                wrapped = UnifiedCursor(cursor, is_postgres=True)
                wrapped.lastrowid = inserted_id["id"] if inserted_id else None
                return wrapped

        cursor.execute(sql, params)
        return UnifiedCursor(cursor, is_postgres=self.is_postgres)

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def close(self):
        self.conn.close()


_DB_INITIALIZED = False

def get_db():
    """Open a connection to PostgreSQL (Supabase) or SQLite for this request."""
    global _DB_INITIALIZED
    if "db" not in g:
        g.db = UnifiedDB(db_url=os.environ.get("DATABASE_URL"), sqlite_path=app.config["DATABASE"])
    if not _DB_INITIALIZED:
        init_db_tables(g.db)
        _DB_INITIALIZED = True
    return g.db


@app.teardown_appcontext
def close_db(exc):
    """Close the database connection when the request ends."""
    db = getattr(g, "db", None)
    if db is not None:
        db.close()


def init_db_tables(db):
    """Create tables and seed admin user & parking slots."""
    if db.is_postgres:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id          SERIAL PRIMARY KEY,
                name        VARCHAR(255) NOT NULL,
                college_id  VARCHAR(100) NOT NULL UNIQUE,
                email       VARCHAR(255) NOT NULL,
                created_at  VARCHAR(100) NOT NULL
            );
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS vehicles (
                id              SERIAL PRIMARY KEY,
                user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                vehicle_number  VARCHAR(100) NOT NULL UNIQUE,
                vehicle_type    VARCHAR(50) NOT NULL,
                qr_token        VARCHAR(255) NOT NULL UNIQUE,
                created_at      VARCHAR(100) NOT NULL
            );
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS parking_slots (
                id           SERIAL PRIMARY KEY,
                slot_number  VARCHAR(50) NOT NULL UNIQUE,
                status       VARCHAR(50) NOT NULL DEFAULT 'FREE',
                vehicle_id   INTEGER REFERENCES vehicles(id) ON DELETE SET NULL
            );
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS parking_records (
                id          SERIAL PRIMARY KEY,
                vehicle_id  INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
                slot_id     INTEGER NOT NULL REFERENCES parking_slots(id) ON DELETE CASCADE,
                entry_time  VARCHAR(100) NOT NULL,
                exit_time   VARCHAR(100),
                status      VARCHAR(50) NOT NULL DEFAULT 'PARKED'
            );
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_users (
                id             SERIAL PRIMARY KEY,
                username       VARCHAR(100) NOT NULL UNIQUE,
                password_hash  VARCHAR(255) NOT NULL
            );
            """
        )
    else:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT NOT NULL,
                college_id  TEXT NOT NULL UNIQUE,
                email       TEXT NOT NULL,
                created_at  TEXT NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS vehicles (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id         INTEGER NOT NULL,
                vehicle_number  TEXT NOT NULL UNIQUE,
                vehicle_type    TEXT NOT NULL,
                qr_token        TEXT NOT NULL UNIQUE,
                created_at      TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS parking_slots (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                slot_number  TEXT NOT NULL UNIQUE,
                status       TEXT NOT NULL DEFAULT 'FREE',
                vehicle_id   INTEGER
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS parking_records (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicle_id  INTEGER NOT NULL,
                slot_id     INTEGER NOT NULL,
                entry_time  TEXT NOT NULL,
                exit_time   TEXT,
                status      TEXT NOT NULL,
                FOREIGN KEY (vehicle_id) REFERENCES vehicles (id),
                FOREIGN KEY (slot_id) REFERENCES parking_slots (id)
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_users (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                username       TEXT NOT NULL UNIQUE,
                password_hash  TEXT NOT NULL
            )
            """
        )

    # --- Seed 20 slots once -------------------------------------------------
    count = db.execute("SELECT COUNT(*) FROM parking_slots").fetchone()[0]
    if count == 0:
        slots = [f"A{i:02d}" for i in range(1, 11)] + [f"B{i:02d}" for i in range(1, 11)]
        for slot in slots:
            db.execute(
                "INSERT INTO parking_slots (slot_number, status) VALUES (?, ?)",
                (slot, "FREE"),
            )

    admin = db.execute(
        "SELECT id FROM admin_users WHERE username = 'admin'"
    ).fetchone()
    if admin is None:
        db.execute(
            "INSERT INTO admin_users (username, password_hash) VALUES (?, ?)",
            ("admin", generate_password_hash("admin123")),
        )

    db.commit()


# ---------------------------------------------------------------------------
# Business logic helpers
# ---------------------------------------------------------------------------
def find_free_slot():
    """
    Return the first parking slot with status FREE.
    Slots are ordered by their natural A01, A02 ... B10 order.
    """
    db = get_db()
    # Order by a computed key so A01..A10 come before B01..B10.
    row = db.execute(
        """
        SELECT * FROM parking_slots
        WHERE status = 'FREE'
        ORDER BY substr(slot_number, 1, 1), CAST(substr(slot_number, 2) AS INTEGER)
        LIMIT 1
        """
    ).fetchone()
    return row


def assign_slot(vehicle_id, slot_id):
    """
    Mark a slot as OCCUPIED, attach the vehicle, and create a PARKED record.
    Returns the created parking record.
    """
    db = get_db()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    db.execute(
        "UPDATE parking_slots SET status = 'OCCUPIED', vehicle_id = ? WHERE id = ?",
        (vehicle_id, slot_id),
    )
    cur = db.execute(
        """
        INSERT INTO parking_records (vehicle_id, slot_id, entry_time, status)
        VALUES (?, ?, ?, 'PARKED')
        """,
        (vehicle_id, slot_id, now),
    )
    db.commit()
    return db.execute(
        "SELECT * FROM parking_records WHERE id = ?", (cur.lastrowid,)
    ).fetchone()


def release_slot(slot_id):
    """Mark a slot as FREE again and detach the vehicle."""
    db = get_db()
    db.execute(
        "UPDATE parking_slots SET status = 'FREE', vehicle_id = NULL WHERE id = ?",
        (slot_id,),
    )
    db.commit()


def get_local_ip():
    """
    Determines the local network LAN IP address of this machine.
    Falls back to '127.0.0.1' if disconnected or detection fails.
    """
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def generate_qr(vehicle_id, qr_token):
    """
    Create a QR image file for a vehicle.
    Priority order:
      1. BASE_URL or PUBLIC_URL or VERCEL_URL if set
      2. request.host_url if in request context and not loopback (127.0.0.1/localhost)
      3. detected LAN IP (via get_local_ip())
      4. 127.0.0.1 fallback
    """
    custom_base = (
        os.environ.get("BASE_URL")
        or os.environ.get("PUBLIC_URL")
        or os.environ.get("VERCEL_URL")
    )
    if custom_base:
        if not custom_base.startswith("http://") and not custom_base.startswith("https://"):
            custom_base = "http://" + custom_base
        base = custom_base.rstrip("/")
    else:
        lan_ip = get_local_ip()
        if has_request_context():
            host_url = request.host_url.rstrip("/")
            if "127.0.0.1" in host_url or "localhost" in host_url:
                if lan_ip and lan_ip != "127.0.0.1":
                    base = host_url.replace("127.0.0.1", lan_ip).replace("localhost", lan_ip)
                else:
                    base = host_url
            else:
                base = host_url
        else:
            if lan_ip and lan_ip != "127.0.0.1":
                base = f"http://{lan_ip}:5000"
            else:
                base = "http://127.0.0.1:5000"

    verify_url = f"{base}/verify/{qr_token}"

    filename = f"vehicle_{vehicle_id}.png"
    os.makedirs(app.config["QR_FOLDER"], exist_ok=True)
    path = os.path.join(app.config["QR_FOLDER"], filename)

    img = qrcode.make(verify_url)
    img.save(path)
    return filename


def get_parking_stats():
    """Return a dict with total/free/occupied slot counts."""
    db = get_db()
    total = db.execute("SELECT COUNT(*) FROM parking_slots").fetchone()[0]
    free = db.execute(
        "SELECT COUNT(*) FROM parking_slots WHERE status = 'FREE'"
    ).fetchone()[0]
    occupied = total - free
    return {"total": total, "free": free, "occupied": occupied}


def get_current_parked_vehicle(vehicle_id):
    """Return the active PARKED record for a vehicle, or None."""
    db = get_db()
    return db.execute(
        """
        SELECT pr.*, ps.slot_number
        FROM parking_records pr
        JOIN parking_slots ps ON ps.id = pr.slot_id
        WHERE pr.vehicle_id = ? AND pr.status = 'PARKED'
        ORDER BY pr.id DESC LIMIT 1
        """,
        (vehicle_id,),
    ).fetchone()


# ---------------------------------------------------------------------------
# Authentication helpers
# ---------------------------------------------------------------------------
def login_required(view):
    """Simple decorator that redirects to /login when the user is not logged in."""
    from functools import wraps

    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("logged_in"):
            flash("Please login to access this page.", "warning")
            return redirect(url_for("login", next=request.path))
        return view(*args, **kwargs)

    return wrapped


# ---------------------------------------------------------------------------
# Public routes
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    """Register a new vehicle. Enforces unique college_id and vehicle_number."""
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        college_id = request.form.get("college_id", "").strip()
        email = request.form.get("email", "").strip()
        vehicle_number = request.form.get("vehicle_number", "").strip().upper()
        vehicle_type = request.form.get("vehicle_type", "").strip()

        # Basic server-side validation --------------------------------
        if not all([name, college_id, email, vehicle_number, vehicle_type]):
            flash("All fields are required.", "danger")
            return redirect(url_for("register"))

        if vehicle_type not in ("Bike", "Car"):
            flash("Vehicle type must be Bike or Car.", "danger")
            return redirect(url_for("register"))

        db = get_db()

        # Prevent duplicate college ID --------------------------------
        existing_user = db.execute(
            "SELECT id FROM users WHERE college_id = ?", (college_id,)
        ).fetchone()
        if existing_user:
            flash(f"College ID '{college_id}' is already registered.", "danger")
            return redirect(url_for("register"))

        # Prevent duplicate vehicle number ----------------------------
        existing_vehicle = db.execute(
            "SELECT id FROM vehicles WHERE vehicle_number = ?", (vehicle_number,)
        ).fetchone()
        if existing_vehicle:
            flash(f"Vehicle number '{vehicle_number}' is already registered.", "danger")
            return redirect(url_for("register"))

        try:
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cur = db.execute(
                """
                INSERT INTO users (name, college_id, email, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (name, college_id, email, now),
            )
            user_id = cur.lastrowid

            qr_token = str(uuid.uuid4())  # unique, safe token
            cur = db.execute(
                """
                INSERT INTO vehicles (user_id, vehicle_number, vehicle_type, qr_token, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user_id, vehicle_number, vehicle_type, qr_token, now),
            )
            vehicle_id = cur.lastrowid

            generate_qr(vehicle_id, qr_token)
            db.commit()

            flash("Registration successful! Your QR code is ready.", "success")
            return redirect(url_for("show_qr", vehicle_id=vehicle_id))
        except sqlite3.IntegrityError:
            db.rollback()
            flash("Database error: duplicate college ID or vehicle number.", "danger")
            return redirect(url_for("register"))

    return render_template("register.html")


@app.route("/qr/<int:vehicle_id>")
def show_qr(vehicle_id):
    """Display the generated QR code and vehicle details."""
    db = get_db()
    vehicle = db.execute(
        """
        SELECT v.*, u.name, u.college_id, u.email
        FROM vehicles v JOIN users u ON u.id = v.user_id
        WHERE v.id = ?
        """,
        (vehicle_id,),
    ).fetchone()

    if vehicle is None:
        flash("Vehicle not found.", "danger")
        return redirect(url_for("index"))

    parked = get_current_parked_vehicle(vehicle["id"])
    status = "PARKED" if parked else "NOT PARKED"

    # The QR image file is saved as static/qr/vehicle_<id>.png
    qr_image = f"vehicle_{vehicle['id']}.png"
    qr_path = os.path.join(app.config["QR_FOLDER"], qr_image)
    if not os.path.exists(qr_path):
        generate_qr(vehicle["id"], vehicle["qr_token"])

    return render_template("qr.html", vehicle=vehicle, qr_image=qr_image, status=status)


@app.route("/verify/<token>")
def verify_token(token):
    """
    Public verify page. Anyone can open it from the QR.
    Shows VALID QR, vehicle info and current parking status.
    Security then clicks ALLOW ENTRY / EXIT here (or uses /scan).
    """
    db = get_db()
    vehicle = db.execute(
        """
        SELECT v.*, u.name, u.college_id, u.email
        FROM vehicles v JOIN users u ON u.id = v.user_id
        WHERE v.qr_token = ?
        """,
        (token,),
    ).fetchone()

    if vehicle is None:
        # Invalid / unknown QR token
        return render_template("vehicle.html", valid=False)

    parked = get_current_parked_vehicle(vehicle["id"])
    free_slot = find_free_slot()

    return render_template(
        "vehicle.html",
        valid=True,
        vehicle=vehicle,
        parked=parked,
        free_slot=free_slot,
    )


@app.route("/login", methods=["GET", "POST"])
def login():
    """Simple admin login. Password is hashed in the database."""
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        db = get_db()
        admin = db.execute(
            "SELECT * FROM admin_users WHERE username = ?", (username,)
        ).fetchone()

        if admin and check_password_hash(admin["password_hash"], password):
            session.clear()
            session["logged_in"] = True
            session["username"] = username
            session.permanent = True
            flash(f"Welcome back, {username}!", "success")
            nxt = request.args.get("next")
            return redirect(nxt if nxt and nxt.startswith("/") else url_for("admin_dashboard"))
        else:
            flash("Invalid username or password.", "danger")

    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    flash("You have been logged out.", "info")
    return redirect(url_for("index"))


@app.route("/dashboard")
def dashboard():
    """Public parking dashboard with live stats and the parking grid."""
    db = get_db()
    stats = get_parking_stats()
    slots = db.execute(
        """
        SELECT ps.*, v.vehicle_number, v.vehicle_type, pr.entry_time
        FROM parking_slots ps
        LEFT JOIN vehicles v ON v.id = ps.vehicle_id
        LEFT JOIN parking_records pr
               ON pr.vehicle_id = ps.vehicle_id AND pr.status = 'PARKED'
        ORDER BY substr(ps.slot_number, 1, 1), CAST(substr(ps.slot_number, 2) AS INTEGER)
        """
    ).fetchall()
    return render_template("dashboard.html", stats=stats, slots=slots)


# ---------------------------------------------------------------------------
# Security / admin routes
# ---------------------------------------------------------------------------
@app.route("/admin")
@login_required
def admin_dashboard():
    """Admin dashboard: statistics + currently parked vehicles."""
    db = get_db()
    stats = get_parking_stats()
    registered = db.execute("SELECT COUNT(*) FROM vehicles").fetchone()[0]
    currently_parked = db.execute(
        "SELECT COUNT(*) FROM parking_records WHERE status = 'PARKED'"
    ).fetchone()[0]

    slots = db.execute(
        """
        SELECT ps.*, v.vehicle_number, v.vehicle_type, pr.entry_time
        FROM parking_slots ps
        LEFT JOIN vehicles v ON v.id = ps.vehicle_id
        LEFT JOIN parking_records pr
               ON pr.vehicle_id = ps.vehicle_id AND pr.status = 'PARKED'
        ORDER BY substr(ps.slot_number, 1, 1), CAST(substr(ps.slot_number, 2) AS INTEGER)
        """
    ).fetchall()

    current = db.execute(
        """
        SELECT pr.entry_time, ps.slot_number,
               v.vehicle_number, v.vehicle_type, v.qr_token, u.name AS owner
        FROM parking_records pr
        JOIN vehicles v ON v.id = pr.vehicle_id
        JOIN users u ON u.id = v.user_id
        JOIN parking_slots ps ON ps.id = pr.slot_id
        WHERE pr.status = 'PARKED'
        ORDER BY pr.entry_time DESC
        """
    ).fetchall()

    return render_template(
        "admin.html",
        stats=stats,
        registered=registered,
        currently_parked=currently_parked,
        current=current,
        slots=slots,
    )


@app.route("/scan")
@login_required
def scan():
    """Security scanner page using the device camera."""
    return render_template("scan.html")


@app.route("/entry/<int:vehicle_id>", methods=["POST"])
@login_required
def entry(vehicle_id):
    """
    Allow a verified vehicle to enter. Assigns the first free slot.
    Prevents duplicate entry if the vehicle is already parked.
    """
    db = get_db()
    vehicle = db.execute(
        "SELECT * FROM vehicles WHERE id = ?", (vehicle_id,)
    ).fetchone()

    if vehicle is None:
        flash("Vehicle not found.", "danger")
        return redirect(url_for("index"))

    # Already parked? Do NOT assign another slot.
    if get_current_parked_vehicle(vehicle_id):
        flash(f"Vehicle {vehicle['vehicle_number']} is already parked.", "warning")
        return redirect(url_for("verify_token", token=vehicle["qr_token"]))

    free_slot = find_free_slot()
    if free_slot is None:
        flash("PARKING FULL - No parking slots are currently available.", "danger")
        return redirect(url_for("verify_token", token=vehicle["qr_token"]))

    record = assign_slot(vehicle_id, free_slot["id"])
    entry_time = datetime.strptime(record["entry_time"], "%Y-%m-%d %H:%M:%S").strftime(
        "%I:%M %p"
    )

    flash(
        f"Entry Successful! {vehicle['vehicle_number']} → Slot {free_slot['slot_number']} at {entry_time}",
        "success",
    )
    return redirect(url_for("verify_token", token=vehicle["qr_token"]))


@app.route("/exit/<int:vehicle_id>", methods=["POST"])
@login_required
def exit_vehicle(vehicle_id):
    """
    Release a parked vehicle. Closes the active parking record and frees the slot.
    """
    db = get_db()
    vehicle = db.execute(
        "SELECT * FROM vehicles WHERE id = ?", (vehicle_id,)
    ).fetchone()

    if vehicle is None:
        flash("Vehicle not found.", "danger")
        return redirect(url_for("index"))

    parked = get_current_parked_vehicle(vehicle_id)
    if parked is None:
        flash(f"Vehicle {vehicle['vehicle_number']} is not parked.", "info")
        return redirect(url_for("verify_token", token=vehicle["qr_token"]))

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db.execute(
        "UPDATE parking_records SET exit_time = ?, status = 'EXITED' WHERE id = ?",
        (now, parked["id"]),
    )
    release_slot(parked["slot_id"])
    db.commit()

    flash(f"{vehicle['vehicle_number']} has exited. Slot {parked['slot_number']} is now FREE.", "success")
    return redirect(url_for("verify_token", token=vehicle["qr_token"]))


@app.route("/history")
@login_required
def history():
    """Parking history with optional search by vehicle number."""
    db = get_db()
    q = request.args.get("q", "").strip().upper()

    if q:
        rows = db.execute(
            """
            SELECT pr.entry_time, pr.exit_time, pr.status,
                   ps.slot_number, v.vehicle_number, u.name AS owner
            FROM parking_records pr
            JOIN vehicles v ON v.id = pr.vehicle_id
            JOIN users u ON u.id = v.user_id
            JOIN parking_slots ps ON ps.id = pr.slot_id
            WHERE v.vehicle_number LIKE ?
            ORDER BY pr.entry_time DESC
            """,
            (f"%{q}%",),
        ).fetchall()
    else:
        rows = db.execute(
            """
            SELECT pr.entry_time, pr.exit_time, pr.status,
                   ps.slot_number, v.vehicle_number, u.name AS owner
            FROM parking_records pr
            JOIN vehicles v ON v.id = pr.vehicle_id
            JOIN users u ON u.id = v.user_id
            JOIN parking_slots ps ON ps.id = pr.slot_id
            ORDER BY pr.entry_time DESC
            """
        ).fetchall()

    return render_template("history.html", rows=rows, q=q)


# ---------------------------------------------------------------------------
# JSON APIs (used by the dashboard for lightweight AJAX polling)
# ---------------------------------------------------------------------------
@app.route("/api/slots")
def api_slots():
    """Return all slots with current status for AJAX polling."""
    db = get_db()
    slots = db.execute(
        """
        SELECT ps.slot_number, ps.status,
               v.vehicle_number, v.vehicle_type, pr.entry_time
        FROM parking_slots ps
        LEFT JOIN vehicles v ON v.id = ps.vehicle_id
        LEFT JOIN parking_records pr
               ON pr.vehicle_id = ps.vehicle_id AND pr.status = 'PARKED'
        ORDER BY substr(ps.slot_number, 1, 1), CAST(substr(ps.slot_number, 2) AS INTEGER)
        """
    ).fetchall()

    return jsonify(
        {
            "stats": get_parking_stats(),
            "slots": [
                {
                    "slot_number": s["slot_number"],
                    "status": s["status"],
                    "vehicle_number": s["vehicle_number"],
                    "vehicle_type": s["vehicle_type"],
                    "entry_time": s["entry_time"],
                }
                for s in slots
            ],
        }
    )


@app.route("/api/vehicle/<int:vehicle_id>")
def api_vehicle(vehicle_id):
    """Return the current status of a vehicle as JSON."""
    db = get_db()
    vehicle = db.execute(
        """
        SELECT v.*, u.name, u.college_id
        FROM vehicles v JOIN users u ON u.id = v.user_id
        WHERE v.id = ?
        """,
        (vehicle_id,),
    ).fetchone()
    if vehicle is None:
        return jsonify({"valid": False}), 404

    parked = get_current_parked_vehicle(vehicle_id)
    free_slot = find_free_slot()
    return jsonify(
        {
            "valid": True,
            "vehicle": dict(vehicle),
            "parked": dict(parked) if parked else None,
            "available_slot": free_slot["slot_number"] if free_slot else None,
            "parking_full": free_slot is None,
        }
    )


# ---------------------------------------------------------------------------
# Error handlers (do NOT expose stack traces to normal users)
# ---------------------------------------------------------------------------
@app.errorhandler(404)
def not_found(e):
    return render_template("error.html", code=404, message="Page not found."), 404


@app.errorhandler(500)
def server_error(e):
    return (
        render_template("error.html", code=500, message="Something went wrong."),
        500,
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    local_ip = get_local_ip()
    print("\n=======================================================")
    print(" CampusPark Server Starting...")
    print(" Localhost:   http://127.0.0.1:5000")
    print(f" LAN Network: http://{local_ip}:5000")
    print("=======================================================\n")
    app.run(host="0.0.0.0", port=5000, debug=True)

