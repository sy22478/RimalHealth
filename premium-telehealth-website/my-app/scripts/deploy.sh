#!/bin/bash
# =============================================================================
# Rimal Health Production Deployment Script
# =============================================================================
# Usage: ./scripts/deploy.sh [environment]
# Environment: production (default) | staging
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
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-production}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/tmp/rimalhealth_deploy_${TIMESTAMP}.log"

# Helper functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗${NC} $1" | tee -a "$LOG_FILE"
}

error_exit() {
    log_error "$1"
    log_error "Deployment failed! Check log: $LOG_FILE"
    exit 1
}

# Pre-deployment checks
pre_deployment_checks() {
    log "Running pre-deployment checks..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        error_exit "Node.js is not installed"
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        error_exit "Node.js version 18+ required, found $(node -v)"
    fi
    log_success "Node.js version check passed: $(node -v)"
    
    # Check if we're in the right directory
    if [ ! -f "$PROJECT_DIR/package.json" ]; then
        error_exit "package.json not found. Are you in the correct directory?"
    fi
    log_success "Project directory verified"
    
    # Check environment variables
    if [ -z "${VERCEL_TOKEN:-}" ]; then
        log_warning "VERCEL_TOKEN not set. Will attempt to use Vercel CLI login."
    fi
    
    if [ -z "${DATABASE_URL:-}" ]; then
        error_exit "DATABASE_URL environment variable not set"
    fi
    
    log_success "Environment variables check passed"
    
    # Check git status
    cd "$PROJECT_DIR"
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
        log_warning "Uncommitted changes detected"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error_exit "Deployment aborted"
        fi
    fi
    
    log_success "Pre-deployment checks completed"
}

# Run tests
run_tests() {
    log "Running tests..."
    cd "$PROJECT_DIR"
    
    # Run linter
    log "Running linter..."
    if ! npm run lint >> "$LOG_FILE" 2>&1; then
        error_exit "Linting failed"
    fi
    log_success "Linting passed"
    
    # Run type check
    log "Running TypeScript type check..."
    if ! npx tsc --noEmit >> "$LOG_FILE" 2>&1; then
        error_exit "Type check failed"
    fi
    log_success "Type check passed"
    
    # Run unit tests
    log "Running unit tests..."
    if ! npm run test:unit >> "$LOG_FILE" 2>&1; then
        error_exit "Unit tests failed"
    fi
    log_success "Unit tests passed"
    
    log_success "All tests passed"
}

# Build application
build_application() {
    log "Building application..."
    cd "$PROJECT_DIR"
    
    # Generate Prisma Client
    log "Generating Prisma Client..."
    if ! npx prisma generate >> "$LOG_FILE" 2>&1; then
        error_exit "Prisma Client generation failed"
    fi
    
    # Build Next.js
    log "Building Next.js application..."
    if ! npm run build >> "$LOG_FILE" 2>&1; then
        error_exit "Build failed"
    fi
    
    log_success "Application built successfully"
}

# Deploy to Vercel
deploy_vercel() {
    log "Deploying to Vercel ($ENVIRONMENT)..."
    cd "$PROJECT_DIR"
    
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        log "Installing Vercel CLI..."
        npm install -g vercel >> "$LOG_FILE" 2>&1
    fi
    
    # Deploy
    if [ -n "${VERCEL_TOKEN:-}" ]; then
        if ! vercel --prod --token="$VERCEL_TOKEN" --confirm >> "$LOG_FILE" 2>&1; then
            error_exit "Vercel deployment failed"
        fi
    else
        if ! vercel --prod >> "$LOG_FILE" 2>&1; then
            error_exit "Vercel deployment failed"
        fi
    fi
    
    log_success "Deployed to Vercel"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    cd "$PROJECT_DIR"
    
    if ! npx prisma migrate deploy >> "$LOG_FILE" 2>&1; then
        error_exit "Database migration failed"
    fi
    
    log_success "Database migrations completed"
}

# Health check
health_check() {
    log "Running health check..."
    
    local url
    if [ "$ENVIRONMENT" == "production" ]; then
        url="${NEXT_PUBLIC_APP_URL:-https://rimalhealth.com}"
    else
        url="${NEXT_PUBLIC_APP_URL:-https://staging.rimalhealth.com}"
    fi
    
    # Wait for deployment to stabilize
    log "Waiting for deployment to stabilize (30s)..."
    sleep 30
    
    # Check health endpoint
    local attempts=0
    local max_attempts=5
    
    while [ $attempts -lt $max_attempts ]; do
        if curl -sf "${url}/api/health" > /dev/null 2>&1; then
            log_success "Health check passed"
            return 0
        fi
        
        attempts=$((attempts + 1))
        log_warning "Health check attempt $attempts failed, retrying in 10s..."
        sleep 10
    done
    
    error_exit "Health check failed after $max_attempts attempts"
}

# Run smoke tests
run_smoke_tests() {
    log "Running smoke tests..."
    cd "$PROJECT_DIR"
    
    if ! npm run test:smoke >> "$LOG_FILE" 2>&1; then
        error_exit "Smoke tests failed"
    fi
    
    log_success "Smoke tests passed"
}

# Create deployment record
create_deployment_record() {
    log "Creating deployment record..."
    
    local deploy_info="${PROJECT_DIR}/.deployments"
    mkdir -p "$deploy_info"
    
    cat > "${deploy_info}/${TIMESTAMP}.json" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "${ENVIRONMENT}",
  "commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
  "deployed_by": "$(whoami)",
  "log_file": "${LOG_FILE}"
}
EOF
    
    log_success "Deployment record created"
}

# Main deployment flow
main() {
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║          Rimal Health Deployment Script                      ║"
    echo "║          Environment: ${ENVIRONMENT}                          ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    log "Starting deployment process..."
    log "Log file: $LOG_FILE"
    
    # Run deployment steps
    pre_deployment_checks
    run_tests
    build_application
    deploy_vercel
    run_migrations
    health_check
    run_smoke_tests
    create_deployment_record
    
    # Success!
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║          🎉 Deployment Successful! 🎉                        ║"
    echo "║          Environment: ${ENVIRONMENT}                          ║"
    echo "║          Timestamp: ${TIMESTAMP}                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    log_success "Deployment completed successfully!"
    log "Log file saved to: $LOG_FILE"
}

# Run main function
main "$@"
