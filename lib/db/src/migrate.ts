import pg from "pg";

const { Pool } = pg;

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  destination TEXT NOT NULL,
  description TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  creator_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trip_members (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  joined_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT,
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  notes TEXT,
  transport_data JSONB,
  lodging_data JSONB,
  restauration_data JSONB,
  activite_data JSONB,
  price_per_person REAL,
  price_type TEXT,
  creator_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
`;

let migrated = false;

export async function ensureSchema(): Promise<void> {
  if (migrated) return;
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) return;
  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
  try {
    await pool.query(INIT_SQL);
    migrated = true;
  } finally {
    await pool.end();
  }
}
