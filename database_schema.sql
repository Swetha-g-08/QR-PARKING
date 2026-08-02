-- CampusPark Database Schema for Supabase PostgreSQL

CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    college_id  VARCHAR(100) NOT NULL UNIQUE,
    email       VARCHAR(255) NOT NULL,
    created_at  VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicles (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_number  VARCHAR(100) NOT NULL UNIQUE,
    vehicle_type    VARCHAR(50) NOT NULL,
    qr_token        VARCHAR(255) NOT NULL UNIQUE,
    created_at      VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS parking_slots (
    id           SERIAL PRIMARY KEY,
    slot_number  VARCHAR(50) NOT NULL UNIQUE,
    status       VARCHAR(50) NOT NULL DEFAULT 'FREE',
    vehicle_id   INTEGER REFERENCES vehicles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS parking_records (
    id          SERIAL PRIMARY KEY,
    vehicle_id  INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    slot_id     INTEGER NOT NULL REFERENCES parking_slots(id) ON DELETE CASCADE,
    entry_time  VARCHAR(100) NOT NULL,
    exit_time   VARCHAR(100),
    status      VARCHAR(50) NOT NULL DEFAULT 'PARKED'
);

CREATE TABLE IF NOT EXISTS admin_users (
    id             SERIAL PRIMARY KEY,
    username       VARCHAR(100) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL
);

-- Seed 20 Parking Slots (A01-A10, B01-B10) if table is empty
INSERT INTO parking_slots (slot_number, status)
VALUES 
  ('A01', 'FREE'), ('A02', 'FREE'), ('A03', 'FREE'), ('A04', 'FREE'), ('A05', 'FREE'),
  ('A06', 'FREE'), ('A07', 'FREE'), ('A08', 'FREE'), ('A09', 'FREE'), ('A10', 'FREE'),
  ('B01', 'FREE'), ('B02', 'FREE'), ('B03', 'FREE'), ('B04', 'FREE'), ('B05', 'FREE'),
  ('B06', 'FREE'), ('B07', 'FREE'), ('B08', 'FREE'), ('B09', 'FREE'), ('B10', 'FREE')
ON CONFLICT (slot_number) DO NOTHING;

-- Seed default admin account (username: admin, password: admin123)
INSERT INTO admin_users (username, password_hash)
VALUES ('admin', 'scrypt:32768:8:1$yN8jMv...hashedpassword...')
ON CONFLICT (username) DO NOTHING;
