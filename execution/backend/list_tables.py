import os
import sys
from pathlib import Path
import psycopg2

sys.path.insert(0, str(Path(__file__).parent.parent))
from lib.db_utils import load_env, build_db_url

def main():
    load_env()
    conn = psycopg2.connect(build_db_url())
    with conn.cursor() as cur:
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")
        tables = [r[0] for r in cur.fetchall()]
        print("Tabelas encontradas:", tables)

if __name__ == "__main__":
    main()
