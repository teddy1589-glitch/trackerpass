import argparse
import os
import sys

import psycopg2


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Rewrite stored image URLs from IP to HTTPS domain."
    )
    parser.add_argument(
        "--old-base",
        default="http://89.44.86.30",
        help="Old base URL to replace (default: http://89.44.86.30)",
    )
    parser.add_argument(
        "--new-base",
        default="https://order.rte-consult.ru",
        help="New base URL to use (default: https://order.rte-consult.ru)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only show rows that would be updated.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL is not set", file=sys.stderr)
        return 1

    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor() as cur:
            preview_sql = """
                select
                  amo_lead_id,
                  car_info->>'image_url' as car_image_url,
                  manager_contact->>'avatar_url' as manager_avatar_url
                from rte.orders
                where (car_info->>'image_url') like %s
                   or (manager_contact->>'avatar_url') like %s
                order by amo_lead_id;
            """
            like_pattern = f"{args.old_base}/%"
            cur.execute(preview_sql, (like_pattern, like_pattern))
            rows = cur.fetchall()
            print(f"Found {len(rows)} rows with IP-based URLs.")
            for row in rows:
                print(row)

            if args.dry_run:
                return 0

            update_car_sql = """
                update rte.orders
                set car_info = jsonb_set(
                  car_info,
                  '{image_url}',
                  to_jsonb(replace(car_info->>'image_url', %s, %s)),
                  true
                )
                where (car_info->>'image_url') like %s;
            """
            cur.execute(update_car_sql, (args.old_base, args.new_base, like_pattern))

            update_manager_sql = """
                update rte.orders
                set manager_contact = jsonb_set(
                  manager_contact,
                  '{avatar_url}',
                  to_jsonb(replace(manager_contact->>'avatar_url', %s, %s)),
                  true
                )
                where (manager_contact->>'avatar_url') like %s;
            """
            cur.execute(
                update_manager_sql, (args.old_base, args.new_base, like_pattern)
            )

        conn.commit()
        print("Update complete.")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
