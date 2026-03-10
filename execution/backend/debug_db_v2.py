import os
import psycopg2
from urllib.parse import urlparse

def build_db_url():
    # Hardcoded check based on .env logic to isolate
    supabase_url = "https://bmwvigbktrypgkcbxlxi.supabase.co"
    pwd = "supabase368"
    ref = urlparse(supabase_url).hostname.split(".")[0]
    return f"postgresql://postgres:{pwd}@db.{ref}.supabase.co:5432/postgres"

def main():
    url = build_db_url()
    print(f"Connecting to: {url.split('@')[1]}")
    try:
        conn = psycopg2.connect(url)
        print("Conexão estabelecida!")
        with conn.cursor() as cur:
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")
            tables = [r[0] for r in cur.fetchall()]
            print("Tabelas no schema public:", tables)
            
            if 'leads' in tables:
                print("Tabela 'leads' existe.")
            else:
                print("Tabela 'leads' NÃO existe.")
                
    except Exception as e:
        print(f"Erro: {e}")

if __name__ == "__main__":
    main()
