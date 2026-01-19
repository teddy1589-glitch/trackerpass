import psycopg

DB_HOST = "89.44.86.30"
DB_PORT = 5432
DB_NAME = "rte_clientsweb"
DB_USER = "rte_user"
DB_PASSWORD = "qCXZ4n2p3p"

SCHEMA = "rte"

SQL = """
CREATE SCHEMA IF NOT EXISTS __SCHEMA__;

CREATE TABLE IF NOT EXISTS __SCHEMA__.amocrm_tokens (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_in INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION __SCHEMA__.set_amocrm_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_amocrm_tokens_updated_at ON __SCHEMA__.amocrm_tokens;

CREATE TRIGGER trg_amocrm_tokens_updated_at
BEFORE UPDATE ON __SCHEMA__.amocrm_tokens
FOR EACH ROW
EXECUTE FUNCTION __SCHEMA__.set_amocrm_tokens_updated_at();
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
    print("AmoCRM tokens table created successfully.")


if __name__ == "__main__":
    main()
