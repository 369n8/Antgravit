"""
fine_monetization_patch.py
Adiciona suporte para lucro sobre multas e chargeback automático.
"""

import sys
import os
from pathlib import Path

# Adiciona o diretório base ao sys.path para importar lib
base_path = Path(__file__).parent.parent
sys.path.insert(0, str(base_path))

try:
    import psycopg2
    from lib.db_utils import load_env, build_db_url
except ImportError:
    # Fallback caso a estrutura de pastas seja diferente
    sys.path.insert(0, str(Path(__file__).parent))
    import psycopg2
    # Mock simples se db_utils não carregar
    def load_env(): pass
    def build_db_url(): return os.environ.get("SUPABASE_DB_URL")

def main() -> None:
    load_env()
    db_url = build_db_url()
    if not db_url:
        print("Erro: SUPABASE_DB_URL não encontrada.")
        sys.exit(1)

    conn = None
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        with conn.cursor() as cur:
            print("Conectado ao banco. Iniciando migração de monetização...")

            # 1. Adicionar colunas de monetização na tabela fines
            cur.execute("""
                ALTER TABLE public.fines 
                ADD COLUMN IF NOT EXISTS admin_fee NUMERIC(10,2) DEFAULT 25.00,
                ADD COLUMN IF NOT EXISTS spread_profit NUMERIC(10,2) DEFAULT 0.00,
                ADD COLUMN IF NOT EXISTS chargeback_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
                ADD COLUMN IF NOT EXISTS fleet_paid_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS fleet_paid_amount NUMERIC(10,2);
            """)
            print("✓ Colunas de monetização adicionadas à tabela fines.")

            # 2. Atualizar constraint de status para incluir 'pago_pela_frota'
            cur.execute("ALTER TABLE fines DROP CONSTRAINT IF EXISTS fines_status_check;")
            cur.execute("""
                ALTER TABLE fines ADD CONSTRAINT fines_status_check
                    CHECK (status IN ('pendente', 'indicacao_feita', 'pago', 'contestado', 'pago_pela_frota'));
            """)
            print("✓ Constraint de status atualizada com 'pago_pela_frota'.")

            # 3. Comentários para documentação
            cur.execute("COMMENT ON COLUMN public.fines.admin_fee IS 'Taxa administrativa cobrada do motorista pela gestão da multa';")
            cur.execute("COMMENT ON COLUMN public.fines.spread_profit IS 'Lucro obtido pelo dono da frota através do desconto no pagamento antecipado';")
            print("✓ Comentários adicionados.")

            print("\n🚀 Migração de monetização concluída com sucesso!")

    except Exception as e:
        print(f"❌ Erro durante a migração: {e}")
        sys.exit(1)
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    main()
