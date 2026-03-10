import os
import sys
from pathlib import Path
import psycopg2

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))
from lib.db_utils import load_env, build_db_url

def main():
    load_env()
    url = build_db_url()
    print(f"Connecting to: {url.split('@')[1]}") # Print host only for security
    try:
        conn = psycopg2.connect(url)
        with conn.cursor() as cur:
            cur.execute("SELECT schema_name FROM information_schema.schemata;")
            schemas = [r[0] for r in cur.fetchall()]
            print("Schemas disponíveis:", schemas)
            
            cur.execute("SELECT table_name, table_schema FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog');")
            tables = cur.fetchall()
            print("Tabelas encontradas (nome, schema):")
            for t in tables:
                print(f" - {t[0]} ({t[1]})")
                
    except Exception as e:
        print(f"Erro na conexão/consulta: {e}")

if __name__ == "__main__":
    main()
