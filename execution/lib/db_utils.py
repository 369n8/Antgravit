"""Utilitários compartilhados de conexão ao banco Supabase."""

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

_ENV_PATH = Path(__file__).parent.parent.parent / ".env"


def load_env() -> None:
    if not _ENV_PATH.exists():
        sys.exit(f"Erro: .env não encontrado em {_ENV_PATH}")
    for line in _ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip())


def build_db_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    supabase_url = os.environ.get("SUPABASE_URL", "")
    pwd = os.environ.get("SUPABASE_DB_PASSWORD", "")
    ref = urlparse(supabase_url).hostname.split(".")[0] if supabase_url else ""
    if not ref or not pwd:
        sys.exit(
            "Erro: defina DATABASE_URL ou SUPABASE_DB_PASSWORD no .env\n"
            "  Ex: SUPABASE_DB_PASSWORD=sua_senha_do_dashboard"
        )
    return f"postgresql://postgres:{pwd}@db.{ref}.supabase.co:5432/postgres"
