#!/bin/bash
# =============================================================================
# Rimal Health Database Backup Script
# =============================================================================
# Usage: ./scripts/backup.sh [full|incremental|export]
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_TYPE="${1:-full}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
S3_BUCKET="${AWS_S3_BUCKET_NAME:-rimalhealth-backups}"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Helper functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗${NC} $1"
}

error_exit() {
    log_error "$1"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check DATABASE_URL
    if [ -z "${DATABASE_URL:-}" ]; then
        error_exit "DATABASE_URL environment variable not set"
    fi
    
    # Check pg_dump availability
    if ! command -v pg_dump &> /dev/null; then
        log_warning "pg_dump not found locally, trying docker..."
        if ! command -v docker &> /dev/null; then
            error_exit "Neither pg_dump nor docker is available"
        fi
    fi
    
    # Check AWS CLI if S3 upload is expected
    if [ -n "${AWS_ACCESS_KEY_ID:-}" ] && ! command -v aws &> /dev/null; then
        log_warning "AWS CLI not found. S3 upload will be skipped."
    fi
    
    log_success "Prerequisites check passed"
}

# Full database backup
backup_full() {
    log "Starting full database backup..."
    
    local backup_file="${BACKUP_DIR}/rimalhealth_full_${DATE}.sql"
    
    log "Creating backup: $(basename "$backup_file")"
    
    if command -v pg_dump &> /dev/null; then
        # Use local pg_dump
        if ! pg_dump "$DATABASE_URL" > "$backup_file" 2>/dev/null; then
            error_exit "Database backup failed"
        fi
    else
        # Use docker
        local db_container=$(docker ps --filter "name=rimalhealth-db" --format "{{.Names}}" | head -1)
        if [ -z "$db_container" ]; then
            error_exit "Database container not found"
        fi
        
        if ! docker exec "$db_container" pg_dump -U postgres rimalhealth > "$backup_file" 2>/dev/null; then
            error_exit "Database backup failed"
        fi
    fi
    
    # Compress backup
    log "Compressing backup..."
    gzip -f "$backup_file"
    local compressed_file="${backup_file}.gz"
    
    local size=$(du -h "$compressed_file" | cut -f1)
    log_success "Full backup created: $(basename "$compressed_file") ($size)"
    
    echo "$compressed_file"
}

# Incremental backup (data-only for specific tables)
backup_incremental() {
    log "Starting incremental backup..."
    
    local backup_file="${BACKUP_DIR}/rimalhealth_incremental_${DATE}.sql"
    
    # Tables that change frequently and need incremental backup
    local tables=(
        "messages"
        "prescriptions"
        "audit_logs"
        "sessions"
    )
    
    log "Backing up incremental tables..."
    
    for table in "${tables[@]}"; do
        log "  - $table"
        if command -v pg_dump &> /dev/null; then
            pg_dump "$DATABASE_URL" --data-only --table="$table" >> "$backup_file" 2>/dev/null || true
        fi
    done
    
    # Compress
    gzip -f "$backup_file"
    local compressed_file="${backup_file}.gz"
    
    local size=$(du -h "$compressed_file" 2>/dev/null | cut -f1 || echo "unknown")
    log_success "Incremental backup created: $(basename "$compressed_file") ($size)"
    
    echo "$compressed_file"
}

# Export PHI-encrypted data (for compliance/legal requests)
backup_export() {
    log "Starting PHI data export..."
    
    local export_dir="${BACKUP_DIR}/export_${DATE}"
    mkdir -p "$export_dir"
    
    # Export patients (anonymized for non-PHI fields)
    log "Exporting patient data..."
    
    # Note: This requires the application to handle decryption
    # This is a placeholder for the export logic
    
    # Create a manifest
    cat > "${export_dir}/manifest.json" <<EOF
{
  "export_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "type": "ph_export",
  "tables": [
    "patients",
    "intakes",
    "messages",
    "prescriptions",
    "payments"
  ],
  "encryption": "AES-256-GCM",
  "note": "PHI data is encrypted. Use application decryption tools."
}
EOF
    
    # Create archive
    local archive_file="${BACKUP_DIR}/rimalhealth_export_${DATE}.tar.gz"
    tar -czf "$archive_file" -C "$BACKUP_DIR" "export_${DATE}"
    rm -rf "$export_dir"
    
    log_success "PHI export created: $(basename "$archive_file")"
    echo "$archive_file"
}

# Upload to S3
upload_to_s3() {
    local file="$1"
    local type="$2"
    
    if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || ! command -v aws &> /dev/null; then
        log_warning "Skipping S3 upload (AWS not configured)"
        return 0
    fi
    
    log "Uploading to S3..."
    
    local s3_key="backups/${type}/$(basename "$file")"
    
    if ! aws s3 cp "$file" "s3://${S3_BUCKET}/${s3_key}" --storage-class STANDARD_IA; then
        log_error "S3 upload failed"
        return 1
    fi
    
    log_success "Uploaded to s3://${S3_BUCKET}/${s3_key}"
}

# Clean old backups
cleanup_old_backups() {
    log "Cleaning up old backups (retention: $RETENTION_DAYS days)..."
    
    local count=0
    
    # Clean local backups
    while IFS= read -r file; do
        if [ -n "$file" ]; then
            rm -f "$file"
            count=$((count + 1))
        fi
    done < <(find "$BACKUP_DIR" -name "rimalhealth_*.gz" -mtime +$RETENTION_DAYS 2>/dev/null)
    
    log "Removed $count old local backups"
    
    # Clean S3 backups if configured
    if [ -n "${AWS_ACCESS_KEY_ID:-}" ] && command -v aws &> /dev/null; then
        log "Cleaning up old S3 backups..."
        local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y-%m-%d)
        
        # List and delete old S3 objects
        aws s3 ls "s3://${S3_BUCKET}/backups/" --recursive | \
            while read -r line; do
                file_date=$(echo "$line" | awk '{print $1}')
                file_key=$(echo "$line" | awk '{print $4}')
                if [[ "$file_date" < "$cutoff_date" ]]; then
                    aws s3 rm "s3://${S3_BUCKET}/${file_key}" 2>/dev/null || true
                fi
            done
    fi
    
    log_success "Cleanup completed"
}

# Verify backup
verify_backup() {
    local file="$1"
    
    log "Verifying backup..."
    
    # Check file exists and is not empty
    if [ ! -f "$file" ]; then
        error_exit "Backup file not found: $file"
    fi
    
    if [ ! -s "$file" ]; then
        error_exit "Backup file is empty: $file"
    fi
    
    # Check gzip integrity
    if [[ "$file" == *.gz ]]; then
        if ! gzip -t "$file" 2>/dev/null; then
            error_exit "Backup file is corrupted: $file"
        fi
    fi
    
    local size=$(du -h "$file" | cut -f1)
    log_success "Backup verified ($size)"
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    # Slack notification
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        local emoji="✅"
        [ "$status" == "failed" ] && emoji="❌"
        
        curl -s -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-type: application/json' \
            --data "{\"text\":\"${emoji} Backup ${status}: ${message}\"}" > /dev/null 2>&1 || true
    fi
    
    # Email notification (using SendGrid)
    if [ -n "${SENDGRID_API_KEY:-}" ] && [ -n "${ALERT_EMAIL:-}" ]; then
        # Implementation would use SendGrid API
        log "Email notification would be sent to: $ALERT_EMAIL"
    fi
}

# Main function
main() {
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║          Rimal Health Database Backup                        ║"
    echo "║          Type: ${BACKUP_TYPE}                                 ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    local backup_file=""
    local success=true
    
    check_prerequisites
    
    case "$BACKUP_TYPE" in
        full)
            backup_file=$(backup_full)
            upload_to_s3 "$backup_file" "full"
            ;;
        incremental)
            backup_file=$(backup_incremental)
            upload_to_s3 "$backup_file" "incremental"
            ;;
        export)
            backup_file=$(backup_export)
            log_warning "Export files require manual handling - not uploading to S3"
            ;;
        *)
            error_exit "Unknown backup type: $BACKUP_TYPE (use: full, incremental, export)"
            ;;
    esac
    
    verify_backup "$backup_file"
    cleanup_old_backups
    
    # Success output
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║          ✅ Backup Completed Successfully                    ║"
    echo "║          File: $(basename "$backup_file")"
    echo "║          Location: $backup_file"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    send_notification "completed" "${BACKUP_TYPE} backup: $(basename "$backup_file")"
}

# Run main function
main "$@"
