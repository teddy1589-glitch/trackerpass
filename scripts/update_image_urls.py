import os
import sys

import psycopg

DB_HOST = "89.44.86.30"
DB_PORT = 5432
DB_NAME = "rte_clientsweb"
DB_USER = "rte_user"
DB_PASSWORD = "qCXZ4n2p3p"

OLD_BASE = os.getenv("OLD_BASE_URL", "http://89.44.86.30")
NEW_BASE = os.getenv("NEW_BASE_URL", "https://order.rte-consult.ru")


def get_conn_str() -> str:
    # Prefer DATABASE_URL if set, otherwise use individual params.
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url

    host = DB_HOST
    port = DB_PORT
    name = DB_NAME
    user = DB_USER
    password = DB_PASSWORD

    if not all([host, name, user, password]):
        raise RuntimeError(
            "Set DATABASE_URL or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD env vars."
        )

    return (
        f"host={host} port={port} dbname={name} user={user} "
        f"password={password} sslmode=disable"
    )


def main() -> int:
    conn_str = get_conn_str()
    like_pattern = f"{OLD_BASE}/%"

    with psycopg.connect(conn_str) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select
                  amo_lead_id,
                  car_info->>'image_url' as car_image_url,
                  manager_contact->>'avatar_url' as manager_avatar_url
                from rte.orders
                where (car_info->>'image_url') like %s
                   or (manager_contact->>'avatar_url') like %s
                order by amo_lead_id;
                """,
                (like_pattern, like_pattern),
            )
            rows = cur.fetchall()
            print(f"Found {len(rows)} rows with IP-based URLs.")

            cur.execute(
                """
                update rte.orders
                set car_info = jsonb_set(
                  car_info,
                  '{image_url}',
                  to_jsonb(replace(car_info->>'image_url', %s, %s)),
                  true
                )
                where (car_info->>'image_url') like %s;
                """,
                (OLD_BASE, NEW_BASE, like_pattern),
            )

            cur.execute(
                """
                update rte.orders
                set manager_contact = jsonb_set(
                  manager_contact,
                  '{avatar_url}',
                  to_jsonb(replace(manager_contact->>'avatar_url', %s, %s)),
                  true
                )
                where (manager_contact->>'avatar_url') like %s;
                """,
                (OLD_BASE, NEW_BASE, like_pattern),
            )

        conn.commit()

    print("Update complete.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise
