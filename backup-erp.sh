#!/bin/bash
# backup-erp.sh — Script de backup do ERP Tapajós
# Executa: ./backup-erp.sh
# Automatizar: crontab -e → "0 12 * * * /caminho/para/backup-erp.sh"

# ── Configuração ────────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/backups}"
DATE=$(date +%Y%m%d_%H%M%S)
DB_CONTAINER="erp_db"
DB_NAME="erp"
DB_USER="postgres"
KEEP_DAYS=30

# ── Backup do banco ─────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Iniciando backup..."

if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  echo "[ERRO] Container '$DB_CONTAINER' não está rodando."
  exit 1
fi

OUTFILE="$BACKUP_DIR/erp_$DATE.sql"
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" > "$OUTFILE"

if [ $? -ne 0 ] || [ ! -s "$OUTFILE" ]; then
  echo "[ERRO] Falha ao gerar backup."
  rm -f "$OUTFILE"
  exit 1
fi

gzip "$OUTFILE"
echo "[OK] Banco salvo em: ${OUTFILE}.gz"

# ── Backup dos arquivos gerados (XMLs, PDFs, uploads) ───────────────────────────
if [ -d "$(dirname "$0")/uploads" ]; then
  tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" -C "$(dirname "$0")" uploads/
  echo "[OK] Uploads salvos em: $BACKUP_DIR/uploads_$DATE.tar.gz"
fi

# ── Limpeza de backups antigos ───────────────────────────────────────────────────
find "$BACKUP_DIR" -name "erp_*.sql.gz"      -mtime +$KEEP_DAYS -delete
find "$BACKUP_DIR" -name "uploads_*.tar.gz"  -mtime +$KEEP_DAYS -delete
echo "[OK] Backups com mais de $KEEP_DAYS dias removidos."

echo "[$(date)] Backup concluído."
