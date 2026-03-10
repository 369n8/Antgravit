import os
import sys
from pathlib import Path
import json
from datetime import datetime, timezone

# Add root to sys.path
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from supabase import create_client, Client
from lib.db_utils import load_env

def main():
    load_env()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Erro: Credenciais do Supabase não encontradas.")
        sys.exit(1)
        
    supabase: Client = create_client(url, key)
    
    print("Buscando pagamentos pendentes e motoristas...")
    
    # 1. Buscar pagamentos vencidos (paid_status = False e due_date < agora)
    now = datetime.now(timezone.utc).isoformat()
    
    # Nota: O python SDK usa sintaxe de filtro do postgrest
    res = supabase.table("payments").select("*, tenants(name, phone, telegram_id, client_id)").eq("paid_status", False).lt("due_date", now).execute()
    
    overdue_payments = res.data or []
    print(f"Encontrados {len(overdue_payments)} pagamentos vencidos.")
    
    alerts = []
    for p in overdue_payments:
        tenant = p.get("tenants")
        if not tenant:
            continue
            
        alert = {
            "tenant_id": p["tenant_id"],
            "tenant_name": tenant["name"],
            "amount": p["value_amount"],
            "due_date": p["due_date"],
            "phone": tenant.get("phone"),
            "telegram_id": tenant.get("telegram_id"),
            "client_id": tenant["client_id"] # Locadora responsável
        }
        alerts.append(alert)
        
    # Salvar resultado em .tmp para auditoria ou envio posterior
    tmp_path = ROOT / ".tmp"
    tmp_path.mkdir(exist_ok=True)
    
    report_file = tmp_path / f"billing_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    report_file.write_text(json.dumps(alerts, indent=2, ensure_ascii=False))
    
    print(f"✓ Relatório de cobrança gerado em: {report_file}")
    
    if alerts:
        print("\nRESUMO DE INADIMPLÊNCIA:")
        for a in alerts[:5]:
            print(f" - {a['tenant_name']}: R$ {a['amount']} (Venceu em {a['due_date']})")
        if len(alerts) > 5:
            print(f" ... e mais {len(alerts) - 5} motoristas.")
    else:
        print("✓ Nenhum inadimplente encontrado hoje.")

if __name__ == "__main__":
    main()
