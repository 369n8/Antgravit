"""
supabase_setup.py
Cria a tabela 'leads' otimizada no Supabase via conexão direta PostgreSQL.
Credenciais lidas do .env na raiz do projeto.
"""

import sys
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent))

try:
    import psycopg2
except ImportError:
    sys.exit("Erro: instale psycopg2 → pip install psycopg2-binary")

from lib.db_utils import load_env, build_db_url


STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS leads (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        name         TEXT        NOT NULL,
        email        TEXT        NOT NULL,
        phone        TEXT,
        company      TEXT,
        fleet_size   INT         CHECK (fleet_size > 0),
        status       TEXT        NOT NULL DEFAULT 'new'
                                 CHECK (status IN ('new','contacted','qualified','converted','lost')),
        source       TEXT,
        notes        TEXT,
        client_id    UUID        REFERENCES clients(id) ON DELETE SET NULL,
        converted_at TIMESTAMPTZ,
        CONSTRAINT leads_email_key UNIQUE (email)
    )
    """,
    "CREATE INDEX IF NOT EXISTS leads_status_idx  ON leads (status)",
    "CREATE INDEX IF NOT EXISTS leads_created_idx ON leads (created_at DESC)",
    "CREATE INDEX IF NOT EXISTS leads_client_idx  ON leads (client_id) WHERE client_id IS NOT NULL",
    """
    CREATE OR REPLACE FUNCTION leads_set_updated_at()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $$
    """,
    "DROP TRIGGER IF EXISTS leads_updated_at ON leads",
    """
    CREATE TRIGGER leads_updated_at
        BEFORE UPDATE ON leads
        FOR EACH ROW EXECUTE FUNCTION leads_set_updated_at()
    """,
    "ALTER TABLE leads ENABLE ROW LEVEL SECURITY",
    'DROP POLICY IF EXISTS "leads_owner" ON leads',
    """
    CREATE POLICY "leads_owner" ON leads
        USING (client_id = auth.uid())
    """,
]


def main() -> None:
    load_env()
    print("Conectando ao Supabase...")
    conn = None
    try:
        conn = psycopg2.connect(build_db_url())
        conn.autocommit = True
        with conn.cursor() as cur:
            print("Criando tabela 'leads'...")
            for stmt in STATEMENTS:
                try:
                    cur.execute(stmt)
                except psycopg2.Error as e:
                    sys.exit(f"Erro ao executar SQL:\n{stmt.strip()}\n\n{e}")
    except psycopg2.OperationalError as e:
        sys.exit(f"Falha na conexão: {e}")
    finally:
        if conn:
            conn.close()

    print("✓ Tabela 'leads' criada com sucesso.")


if __name__ == "__main__":
    main()
