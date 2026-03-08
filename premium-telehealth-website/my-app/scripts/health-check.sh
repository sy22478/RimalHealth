#!/bin/bash
# =============================================================================
# Rimal Health Health Check Script
# =============================================================================
# Usage: ./scripts/health-check.sh [url]
# Default URL: http://localhost:3000
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${1:-${NEXT_PUBLIC_APP_URL:-http://localhost:3000}}"
TIMEOUT=10
MAX_RETRIES=3
RETRY_DELAY=5

# Endpoints to check
ENDPOINTS=(
    "/api/health"
    "/"
    "/login"
    "/about"
)

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

# Check single endpoint
check_endpoint() {
    local endpoint="$1"
    local url="${BASE_URL}${endpoint}"
    local attempts=0
    
    while [ $attempts -lt $MAX_RETRIES ]; do
        local http_code
        http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url" 2>/dev/null || echo "000")
        
        if [ "$http_code" == "200" ] || [ "$http_code" == "307" ] || [ "$http_code" == "308" ]; then
            log_success "${endpoint} → HTTP ${http_code}"
            return 0
        fi
        
        attempts=$((attempts + 1))
        
        if [ $attempts -lt $MAX_RETRIES ]; then
            log_warning "${endpoint} → HTTP ${http_code} (attempt $attempts/$MAX_RETRIES, retrying in ${RETRY_DELAY}s...)"
            sleep $RETRY_DELAY
        fi
    done
    
    log_error "${endpoint} → HTTP ${http_code} (failed after $MAX_RETRIES attempts)"
    return 1
}

# Check health endpoint with detailed response
check_health_endpoint() {
    local url="${BASE_URL}/api/health"
    
    log "Checking health endpoint..."
    
    local response
    response=$(curl -s --max-time "$TIMEOUT" "$url" 2>/dev/null || echo '{"status":"unreachable"}')
    
    # Parse JSON response (basic parsing)
    local status
    status=$(echo "$response" | grep -o '"status"[^,}]*' | cut -d':' -f2 | tr -d '"' || echo "unknown")
    
    if [ "$status" == "healthy" ]; then
        log_success "Health endpoint: $status"
        echo "$response" | grep -E '"database"|"redis"|"version"' | while read -r line; do
            echo "  $line"
        done
        return 0
    else
        log_error "Health endpoint: $status"
        echo "  Response: $response"
        return 1
    fi
}

# Check SSL certificate
check_ssl() {
    if [[ "$BASE_URL" != https* ]]; then
        return 0
    fi
    
    log "Checking SSL certificate..."
    
    local domain
    domain=$(echo "$BASE_URL" | sed -E 's|https?://||' | cut -d'/' -f1)
    
    local cert_info
    cert_info=$(echo | openssl s_client -servername "$domain" -connect "${domain}:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || true)
    
    if [ -z "$cert_info" ]; then
        log_warning "Could not retrieve SSL certificate information"
        return 0
    fi
    
    local not_after
    not_after=$(echo "$cert_info" | grep "notAfter" | cut -d'=' -f2)
    
    if [ -n "$not_after" ]; then
        local expiry_timestamp
        expiry_timestamp=$(date -d "$not_after" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$not_after" +%s 2>/dev/null)
        local current_timestamp
        current_timestamp=$(date +%s)
        local days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
        
        if [ $days_until_expiry -lt 7 ]; then
            log_error "SSL certificate expires in $days_until_expiry days!"
            return 1
        elif [ $days_until_expiry -lt 30 ]; then
            log_warning "SSL certificate expires in $days_until_expiry days"
        else
            log_success "SSL certificate valid for $days_until_expiry days"
        fi
    fi
}

# Check response times
check_performance() {
    log "Checking response times..."
    
    local total_time=0
    local count=0
    
    for endpoint in "${ENDPOINTS[@]}"; do
        local url="${BASE_URL}${endpoint}"
        local time_ms
        time_ms=$(curl -s -o /dev/null -w "%{time_total}" --max-time "$TIMEOUT" "$url" 2>/dev/null || echo "0")
        
        # Convert to milliseconds
        local time_ms_int
        time_ms_int=$(echo "$time_ms * 1000" | bc 2>/dev/null || echo "0")
        time_ms_int=${time_ms_int%.*}
        
        total_time=$((total_time + time_ms_int))
        count=$((count + 1))
        
        if [ $time_ms_int -gt 2000 ]; then
            log_warning "${endpoint} → ${time_ms_int}ms (slow)"
        fi
    done
    
    local avg_time=$((total_time / count))
    
    if [ $avg_time -lt 500 ]; then
        log_success "Average response time: ${avg_time}ms"
    elif [ $avg_time -lt 1000 ]; then
        log_warning "Average response time: ${avg_time}ms"
    else
        log_error "Average response time: ${avg_time}ms (too slow)"
        return 1
    fi
}

# Check critical business flows
check_business_flows() {
    log "Checking critical business flows..."
    
    local failed=0
    
    # Check homepage loads
    if ! curl -sf --max-time "$TIMEOUT" "${BASE_URL}/" > /dev/null 2>&1; then
        log_error "Homepage not accessible"
        failed=1
    else
        log_success "Homepage accessible"
    fi
    
    # Check API responds
    if ! curl -sf --max-time "$TIMEOUT" "${BASE_URL}/api/health" > /dev/null 2>&1; then
        log_error "API health endpoint not accessible"
        failed=1
    else
        log_success "API health endpoint accessible"
    fi
    
    return $failed
}

# Send alert
send_alert() {
    local message="$1"
    
    # Slack notification
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -s -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 Health Check Alert: ${message}\"}" > /dev/null 2>&1 || true
    fi
}

# Main function
main() {
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║          Rimal Health Health Check                           ║"
    echo "║          URL: ${BASE_URL}"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    local failed=0
    
    # Check all endpoints
    log "Checking endpoints..."
    for endpoint in "${ENDPOINTS[@]}"; do
        if ! check_endpoint "$endpoint"; then
            failed=1
        fi
    done
    
    # Check health endpoint details
    if ! check_health_endpoint; then
        failed=1
    fi
    
    # Check SSL
    check_ssl
    
    # Check performance
    if ! check_performance; then
        failed=1
    fi
    
    # Check business flows
    if ! check_business_flows; then
        failed=1
    fi
    
    # Summary
    echo ""
    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}"
        echo "╔══════════════════════════════════════════════════════════════╗"
        echo "║          ✅ All Health Checks Passed                         ║"
        echo "╚══════════════════════════════════════════════════════════════╝"
        echo -e "${NC}"
        exit 0
    else
        echo -e "${RED}"
        echo "╔══════════════════════════════════════════════════════════════╗"
        echo "║          ❌ Some Health Checks Failed                        ║"
        echo "╚══════════════════════════════════════════════════════════════╝"
        echo -e "${NC}"
        
        send_alert "Health check failed for ${BASE_URL}"
        exit 1
    fi
}

# Run main function
main "$@"
