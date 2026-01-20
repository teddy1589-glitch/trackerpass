import psycopg

DB_HOST = "89.44.86.30"
DB_PORT = 5432
DB_NAME = "rte_clientsweb"
DB_USER = "rte_user"
DB_PASSWORD = "qCXZ4n2p3p"

SCHEMA = "rte"

SQL = """
ALTER TABLE __SCHEMA__.orders
  ALTER COLUMN hash_slug DROP NOT NULL;
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
    print("hash_slug is now nullable.")


if __name__ == "__main__":
    main()
