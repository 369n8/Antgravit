"""
create_inspections_bucket.py
Cria o bucket 'inspections' no Supabase Storage para upload de vídeos de vistoria semanal.
"""
import os
from pathlib import Path


def load_env():
    for p in [Path(__file__).parent.parent / ".env", Path(".env")]:
        if p.exists():
            for line in p.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())
            return
    print("Erro: .env não encontrado.")
    exit(1)


load_env()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Erro: Credenciais do Supabase ausentes.")
    exit(1)

from supabase import create_client

supabase = create_client(url, key)

BUCKET = "inspections"
# 100 MB limit for video files
SIZE_LIMIT = 104857600

try:
    buckets = supabase.storage.list_buckets()
    exists = any(b.name == BUCKET for b in buckets)
    if exists:
        print(f"Bucket '{BUCKET}' já existe.")
    else:
        print(f"Criando bucket '{BUCKET}' público (vídeos de vistoria)...")
        supabase.storage.create_bucket(
            BUCKET,
            options={"public": True, "fileSizeLimit": SIZE_LIMIT, "allowedMimeTypes": ["video/*", "image/*"]}
        )
        print(f"Bucket '{BUCKET}' criado com sucesso!")
except Exception as e:
    print(f"Erro ao criar/verificar bucket: {e}")
