import os
import sys
from pathlib import Path
from supabase import create_client, Client

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))
from lib.db_utils import load_env

def main():
    load_env()
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    
    # Try a select on one row to see what columns we get
    res = supabase.table("tenants").select("*").limit(1).execute()
    if res.data:
        print("Colunas em tenants:", res.data[0].keys())
    else:
        print("Nenhum dado em tenants para checar colunas.")

    res2 = supabase.table("payments").select("*").limit(1).execute()
    if res2.data:
        print("Colunas em payments:", res2.data[0].keys())

if __name__ == "__main__":
    main()
