"""
schema_patch.py
Garante as colunas e tabelas necessárias para os fluxos:
  - Portal do Inquilino: contract_signature_url, contract_signed_at, portal_access_status
  - contracts: tabela completa com RLS
  - vehicle_allocations: histórico imutável de locações para atribuição retroativa de multas
  - fines: status estendido com 'indicacao_feita'
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

            # 1. Colunas na tabela tenants
            cur.execute("""
                ALTER TABLE tenants
                    ADD COLUMN IF NOT EXISTS contract_signature_url TEXT,
                    ADD COLUMN IF NOT EXISTS contract_signed_at     TIMESTAMPTZ,
                    ADD COLUMN IF NOT EXISTS portal_access_status   TEXT DEFAULT 'pending_contract'
                        CHECK (portal_access_status IN ('pending_contract', 'active', 'suspended'))
            """)
            print("✓ Colunas de tenants verificadas/criadas.")

            # 2. Tabela contracts
            cur.execute("""
                CREATE TABLE IF NOT EXISTS contracts (
                    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
                    tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    status      TEXT        DEFAULT 'pending_signature'
                                    CHECK (status IN ('pending_signature', 'active', 'expired', 'terminated')),
                    document_url TEXT,
                    signed_at   TIMESTAMPTZ,
                    created_at  TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            print("✓ Tabela contracts verificada/criada.")

            # 3. RLS na tabela contracts
            cur.execute("ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;")

            # Política: anon pode ler contratos (filtro por tenant_id no lado da app)
            cur.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_policies
                        WHERE tablename = 'contracts' AND policyname = 'anon_read_contracts'
                    ) THEN
                        CREATE POLICY anon_read_contracts ON contracts
                            FOR SELECT TO anon USING (true);
                    END IF;
                END $$;
            """)

            # Política: authenticated pode inserir/atualizar seus próprios contratos
            cur.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_policies
                        WHERE tablename = 'contracts' AND policyname = 'auth_manage_contracts'
                    ) THEN
                        CREATE POLICY auth_manage_contracts ON contracts
                            FOR ALL TO authenticated
                            USING (
                                tenant_id IN (
                                    SELECT id FROM tenants WHERE client_id = auth.uid()
                                )
                            );
                    END IF;
                END $$;
            """)
            print("✓ RLS de contracts verificado/configurado.")

            # 4. Backfill: marcar como 'active' quem já assinou
            cur.execute("""
                UPDATE tenants
                SET portal_access_status = 'active'
                WHERE contract_signature_url IS NOT NULL
                  AND portal_access_status = 'pending_contract'
            """)
            print("✓ Backfill de portal_access_status concluído.")

            # 5. Tabela vehicle_allocations (histórico de locações)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS vehicle_allocations (
                    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
                    vehicle_id  UUID        NOT NULL REFERENCES vehicles(id)  ON DELETE CASCADE,
                    tenant_id   UUID        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
                    client_id   UUID        NOT NULL REFERENCES clients(id)   ON DELETE CASCADE,
                    start_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    end_date    TIMESTAMPTZ,
                    created_at  TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_va_vehicle_dates ON vehicle_allocations (vehicle_id, start_date, end_date);")
            cur.execute("ALTER TABLE vehicle_allocations ENABLE ROW LEVEL SECURITY;")
            cur.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_policies
                        WHERE tablename = 'vehicle_allocations' AND policyname = 'owner_vehicle_allocations'
                    ) THEN
                        CREATE POLICY owner_vehicle_allocations ON vehicle_allocations
                            FOR ALL TO authenticated
                            USING  (client_id = auth.uid())
                            WITH CHECK (client_id = auth.uid());
                    END IF;
                END $$;
            """)
            print("✓ Tabela vehicle_allocations verificada/criada.")

            # 6. Estender status de fines
            cur.execute("ALTER TABLE fines DROP CONSTRAINT IF EXISTS fines_status_check;")
            cur.execute("""
                ALTER TABLE fines ADD CONSTRAINT fines_status_check
                    CHECK (status IN ('pendente', 'indicacao_feita', 'pago', 'contestado'));
            """)
            print("✓ Constraint de status de fines atualizada.")

    except psycopg2.Error as e:
        sys.exit(f"Erro no banco: {e}")
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    main()
