-- 6D Address Somalia - PostgreSQL Schema v1.0

-- Enable the PostGIS extension for geospatial capabilities.
-- This is a critical first step.
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Table: users
-- Stores the core profile information for our end-users (PWA).
-- The 'id' is linked to the Firebase Authentication UID.
CREATE TABLE users (
    id TEXT PRIMARY KEY, -- Firebase UID
    phone_number TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: addresses
-- Stores the *current* official address for each user.
-- This table has a one-to-one relationship with the 'users' table.
CREATE TABLE addresses (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    six_d_code VARCHAR(8) NOT NULL,
    locality_suffix VARCHAR(2) NOT NULL,
    region TEXT NOT NULL,
    city TEXT NOT NULL,
    district TEXT NOT NULL,
    neighborhood TEXT,
    -- The GEOMETRY column for PostGIS. Stores the precise point location.
    -- SRID 4326 is the standard for GPS coordinates (WGS 84).
    location GEOMETRY(Point, 4326) NOT NULL,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create a geospatial index on the 'location' column for extremely fast queries.
CREATE INDEX addresses_location_idx ON addresses USING GIST (location);

-- Table: address_history
-- Stores a log of a user's previous addresses for auditing purposes.
CREATE TABLE address_history (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    six_d_code VARCHAR(8) NOT NULL,
    region TEXT NOT NULL,
    city TEXT NOT NULL,
    district TEXT NOT NULL,
    neighborhood TEXT,
    location GEOMETRY(Point, 4326) NOT NULL,
    registered_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quickly retrieving a user's address history.
CREATE INDEX address_history_user_id_idx ON address_history (user_id);

-- Table: companies
-- Stores information for our B2B/B2G clients.
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    contact_email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: api_keys
-- Stores the API keys for our B2B/B2G clients.
-- This table has a many-to-one relationship with the 'companies' table.
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    api_key_hash TEXT NOT NULL UNIQUE, -- We store a hash of the key, not the key itself.
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quickly looking up a key.
CREATE INDEX api_keys_key_hash_idx ON api_keys (api_key_hash);

-- You can add more tables for permissions, logging, etc. later.
-- This is the solid foundation we need to start building the backend.