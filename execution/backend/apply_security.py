import os
import sys
from pathlib import Path
import psycopg2

# Path to the project root
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from lib.db_utils import load_env, build_db_url

def main():
    load_env()
    sql_path = Path("/Users/goat/Desktop/Projects/infra/security_patch.sql")
    if not sql_path.exists():
        print(f"Erro: {sql_path} não encontrado")
        sys.exit(1)
    
    sql = sql_path.read_text()
    
    print("Conectando ao Supabase para aplicar patches de segurança...")
    conn = None
    try:
        conn = psycopg2.connect(build_db_url())
        conn.autocommit = True
        with conn.cursor() as cur:
            # Multi-statement execution
            cur.execute(sql)
            print("✓ Patches de segurança aplicados com sucesso.")
    except Exception as e:
        print(f"Erro ao aplicar segurança: {e}")
        sys.exit(1)
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    main()
