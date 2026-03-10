import os
from pathlib import Path

def load_env():
    p = Path("../.env")
    if not p.exists():
        p = Path(".env")
    if p.exists():
        for line in p.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())
    else:
        print("Erro: .env não encontrado.")
        exit(1)

load_env()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Erro: Credenciais do Supabase ausentes.")
    exit(1)

from supabase import create_client, Client
supabase: Client = create_client(url, key)

bucket_name = "contracts"
try:
    buckets = supabase.storage.list_buckets()
    exists = any(b.name == bucket_name for b in buckets)
    if exists:
        print(f"Bucket '{bucket_name}' já existe.")
    else:
        print(f"Criando bucket '{bucket_name}' público...")
        # Nota: O python SDK oficial atual pode usar create_bucket direto
        supabase.storage.create_bucket(bucket_name, options={"public": True, "fileSizeLimit": 5242880})
        print("Bucket contracts criado e público!")
except Exception as e:
    print(f"Erro ao criar/verificar bucket: {e}")
