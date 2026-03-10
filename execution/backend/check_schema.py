"""
check_schema.py
Exibe as colunas atuais da tabela tenants.
"""

import sys
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent.parent))

import psycopg2
from lib.db_utils import load_env, build_db_url


def main() -> None:
    load_env()
    conn = None
    try:
        conn = psycopg2.connect(build_db_url())
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'tenants' ORDER BY ordinal_position"
            )
            cols = [r[0] for r in cur.fetchall()]
        print("Colunas tenants:", cols)
    except psycopg2.Error as e:
        sys.exit(f"Erro no banco: {e}")
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    main()
