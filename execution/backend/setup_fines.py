import sys
import psycopg2
from lib.db_utils import load_env, build_db_url

def main() -> None:
    load_env()
    conn = None
    try:
        conn = psycopg2.connect(build_db_url())
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM clients")
            clients = cur.fetchall()
            if not clients:
                print("Nenhum cliente encontrado no DB.")
                return

            for (client_id,) in clients:
                print(f"Configurando scan automático para cliente {client_id}...")
                cur.execute("""
                    INSERT INTO fleet_settings (client_id, api_provider, scan_enabled, document)
                    VALUES (%s, 'mock', true, '00.000.000/0001-00')
                    ON CONFLICT (client_id) DO UPDATE SET
                        api_provider = EXCLUDED.api_provider,
                        scan_enabled = EXCLUDED.scan_enabled,
                        document = EXCLUDED.document
                """, (client_id,))
            
            print("Configuração finalizada com sucesso.")

    except Exception as e:
        sys.exit(f"Erro: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    main()
