#!/usr/bin/env bash
# Backup do volume /data do serviço api na Railway (plano Hobby não tem backup automático).
# Uso: scripts/backup-railway.sh [pasta-destino]   (padrão: ~/alcateia-backups)
# Requer: railway CLI logada. Os dados têm informação pessoal das alunas: a pasta fica com
# permissão 700 e NUNCA deve ir para um repositório. Guarda os 12 backups mais recentes.
set -euo pipefail
PROJECT="${RAILWAY_PROJECT_ID:-24136a9b-94fc-41d1-8f93-5fd3687e8166}"
ENVIRONMENT="${RAILWAY_ENVIRONMENT_ID:-87d0d95a-fb99-4515-a75d-fa9c093c2906}"
VOLUME="${RAILWAY_VOLUME:-api-volume}"
DEST="${1:-$HOME/alcateia-backups}"
STAMP="$(date +%Y-%m-%d_%H%M)"
umask 077
mkdir -p "$DEST"
chmod 700 "$DEST"
railway volume --project "$PROJECT" --environment "$ENVIRONMENT" files --volume "$VOLUME" download /data "$DEST/$STAMP" >/dev/null
test -s "$DEST/$STAMP/db.json" || { echo "backup incompleto: db.json ausente em $DEST/$STAMP" >&2; exit 1; }
tar czf "$DEST/$STAMP.tar.gz" -C "$DEST" "$STAMP" && rm -rf "$DEST/$STAMP"
chmod 600 "$DEST/$STAMP.tar.gz"
ls -1t "$DEST"/*.tar.gz 2>/dev/null | tail -n +13 | xargs -r rm -f
echo "ok: $DEST/$STAMP.tar.gz ($(du -h "$DEST/$STAMP.tar.gz" | cut -f1))"
