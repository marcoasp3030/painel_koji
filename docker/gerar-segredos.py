#!/usr/bin/env python3
"""Gera senha do Postgres e chaves JWT (anon e service_role) em .env."""

import base64
import hashlib
import hmac
import json
import secrets
import time
from pathlib import Path


def b64url(dados: bytes) -> str:
    return base64.urlsafe_b64encode(dados).rstrip(b"=").decode()


def assinar(payload: dict, segredo: str) -> str:
    cabecalho = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    corpo = b64url(json.dumps(payload, separators=(",", ":")).encode())
    assinatura = hmac.new(segredo.encode(), f"{cabecalho}.{corpo}".encode(), hashlib.sha256).digest()
    return f"{cabecalho}.{corpo}.{b64url(assinatura)}"


def main() -> None:
    destino = Path(__file__).resolve().parents[1] / ".env"
    if destino.exists() and destino.stat().st_size > 0:
        print(f"{destino} já existe; não foi alterado.")
        return

    agora = int(time.time())
    expira = agora + 60 * 60 * 24 * 365 * 10
    segredo = secrets.token_hex(32)
    senha = secrets.token_hex(24)
    anon = assinar({"role": "anon", "iss": "supabase", "iat": agora, "exp": expira}, segredo)
    servico = assinar(
        {"role": "service_role", "iss": "supabase", "iat": agora, "exp": expira},
        segredo,
    )
    destino.write_text(
        "\n".join(
            [
                f"POSTGRES_PASSWORD={senha}",
                f"JWT_SECRET={segredo}",
                f"ANON_KEY={anon}",
                f"SERVICE_ROLE_KEY={servico}",
                "SITE_URL=https://painel.luxbrain.com.br",
                "",
            ]
        ),
        encoding="utf-8",
    )
    destino.chmod(0o600)
    print(f"Segredos gravados em {destino}")


if __name__ == "__main__":
    main()
