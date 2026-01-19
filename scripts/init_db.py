import psycopg

DB_HOST = "89.44.86.30"
DB_PORT = 5432
DB_NAME = "rte_clientsweb"
DB_USER = "rte_user"
DB_PASSWORD = "qCXZ4n2p3p"

SCHEMA = "rte"

SQL = """
CREATE SCHEMA IF NOT EXISTS __SCHEMA__;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS __SCHEMA__.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  amo_lead_id INTEGER UNIQUE NOT NULL,
  hash_slug TEXT UNIQUE NOT NULL,
  status_step INTEGER CHECK (status_step >= 1 AND status_step <= 4),
  status_label TEXT,
  car_info JSONB DEFAULT '{}'::jsonb,
  permit_info JSONB DEFAULT '{}'::jsonb,
  manager_contact JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_orders_hash_slug ON __SCHEMA__.orders(hash_slug);
CREATE INDEX IF NOT EXISTS idx_orders_amo_lead_id ON __SCHEMA__.orders(amo_lead_id);

CREATE OR REPLACE FUNCTION __SCHEMA__.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON __SCHEMA__.orders;

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON __SCHEMA__.orders
FOR EACH ROW
EXECUTE FUNCTION __SCHEMA__.set_updated_at();
"""


def main() -> None:
    sql = SQL.replace("__SCHEMA__", SCHEMA)
    conn_str = (
        f"host={DB_HOST} port={DB_PORT} dbname={DB_NAME} "
        f"user={DB_USER} password={DB_PASSWORD} sslmode=disable"
    )
    with psycopg.connect(conn_str) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
    print("Schema created successfully.")


if __name__ == "__main__":
    main()
