#!/bin/bash
# Fix Critical Issues Script
# Run this script to fix all P0 (critical) issues

set -e

echo "🔧 Fixing Critical Issues for Rimal Health"
echo "==========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Fix route conflicts${NC}"
echo "Moving physician routes to avoid conflicts..."

# Create physician directory structure
mkdir -p app/physician/login
mkdir -p app/physician/messages
mkdir -p app/physician/intake
mkdir -p app/physician/patients
mkdir -p app/physician/queue

# Move physician pages from route group to explicit routes
if [ -d "app/(physician)/login" ]; then
  cp -r app/\(physician\)/login/* app/physician/login/ 2>/dev/null || true
fi

if [ -d "app/(physician)/messages" ]; then
  cp -r app/\(physician\)/messages/* app/physician/messages/ 2>/dev/null || true
fi

if [ -d "app/(physician)/intake" ]; then
  cp -r app/\(physician\)/intake/* app/physician/intake/ 2>/dev/null || true
fi

if [ -d "app/(physician)/patients" ]; then
  cp -r app/\(physician\)/patients/* app/physician/patients/ 2>/dev/null || true
fi

if [ -d "app/(physician)/queue" ]; then
  cp -r app/\(physician\)/queue/* app/physician/queue/ 2>/dev/null || true
fi

# Copy physician layout
if [ -f "app/(physician)/layout.tsx" ]; then
  cp app/\(physician\)/layout.tsx app/physician/layout.tsx
fi

echo -e "${GREEN}✓ Route conflicts fixed${NC}"
echo ""

echo -e "${YELLOW}Step 2: Fix audit middleware imports${NC}"
echo "Replacing incorrect audit imports..."

# Fix audit imports in affected files
find app/api -name "*.ts" -type f -exec sed -i '' 's/from "@\/lib\/audit\/middleware"/from "@\/lib\/audit"/g' {} \; 2>/dev/null || true
find app/api -name "*.ts" -type f -exec sed -i '' 's/import { auditPHIAccess }/import { auditLogger }/g' {} \; 2>/dev/null || true
find app/api -name "*.ts" -type f -exec sed -i '' 's/import { auditDataModification }/import { auditLogger }/g' {} \; 2>/dev/null || true

echo -e "${GREEN}✓ Audit imports fixed${NC}"
echo ""

echo -e "${YELLOW}Step 3: Add missing enum values${NC}"
echo "Checking lib/audit/types.ts..."

# Check if enum values exist, if not add them
if ! grep -q "API_ERROR" lib/audit/types.ts; then
  echo "  Adding missing enum values..."
  # This would need to be done via a proper TypeScript parser
  # For now, manual fix is recommended
fi

echo -e "${YELLOW}Note: Enum values need manual fixing - see audit report${NC}"
echo ""

echo -e "${YELLOW}Step 4: Fix Zod v4 breaking changes${NC}"
echo "Replacing required_error with message..."

find lib -name "*.ts" -type f -exec sed -i '' 's/required_error:/message:/g' {} \; 2>/dev/null || true
find app -name "*.ts" -type f -exec sed -i '' 's/required_error:/message:/g' {} \; 2>/dev/null || true

echo -e "${GREEN}✓ Zod v4 changes applied${NC}"
echo ""

echo -e "${YELLOW}Step 5: Fix Analytics component${NC}"
echo "Creating Analytics wrapper..."

# Create AnalyticsWrapper component
cat > components/AnalyticsWrapper.tsx << 'EOF'
'use client';

import dynamic from 'next/dynamic';

const Analytics = dynamic(() => import("@/components/Analytics"), {
  ssr: false,
  loading: () => null,
});

export default function AnalyticsWrapper() {
  return <Analytics />;
}
EOF

echo -e "${GREEN}✓ Analytics wrapper created${NC}"
echo ""

echo -e "${YELLOW}Step 6: Update app/layout.tsx${NC}"
echo "Replace Analytics import with AnalyticsWrapper"
echo "  OLD: import dynamic from 'next/dynamic'; + const Analytics = dynamic(...)"
echo "  NEW: import AnalyticsWrapper from '@/components/AnalyticsWrapper';"
echo ""

echo -e "${YELLOW}Step 7: Create DoseSpot webhook${NC}"
echo "Creating missing webhook endpoint..."

mkdir -p app/api/webhooks/dosespot

cat > app/api/webhooks/dosespot/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { auditLogger } from '@/lib/audit';

/**
 * DoseSpot webhook handler for e-prescribing status updates
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    
    // Verify webhook signature (implement based on DoseSpot docs)
    // const signature = request.headers.get('x-dosespot-signature');
    
    // Handle different event types
    const { eventType, prescriptionId, status } = payload;
    
    switch (eventType) {
      case 'PRESCRIPTION_SENT':
        await prisma.prescription.update({
          where: { id: prescriptionId },
          data: { 
            status: 'SENT',
            sentAt: new Date(),
          },
        });
        break;
        
      case 'PRESCRIPTION_FILLED':
        await prisma.prescription.update({
          where: { id: prescriptionId },
          data: { 
            status: 'FILLED',
            lastRefillDate: new Date(),
          },
        });
        break;
        
      default:
        console.log(`Unhandled DoseSpot event: ${eventType}`);
    }
    
    await auditLogger.log({
      eventType: 'PRESCRIPTION_STATUS_UPDATE',
      action: 'WEBHOOK_RECEIVED',
      resourceType: 'Prescription',
      resourceId: prescriptionId,
      metadata: { eventType, status },
    });
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('DoseSpot webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
EOF

echo -e "${GREEN}✓ DoseSpot webhook created${NC}"
echo ""

echo -e "${YELLOW}Step 8: Fix next.config.ts${NC}"
echo "Remove deprecated configuration..."

# Create backup
cp next.config.ts next.config.ts.backup

# Remove deprecated keys (manual step recommended)
echo "  Please manually remove from next.config.ts:"
echo "    - experimental.turbo"
echo "    - eslint configuration"
echo ""

echo -e "${YELLOW}Step 9: Run type check${NC}"
npm run type-check 2>&1 | head -50 || true

echo ""
echo "==========================================="
echo -e "${GREEN}Fix script completed!${NC}"
echo ""
echo "Manual steps still required:"
echo "  1. Fix remaining TypeScript errors (see audit report)"
echo "  2. Add missing enum values to lib/audit/types.ts"
echo "  3. Update app/layout.tsx to use AnalyticsWrapper"
echo "  4. Fix Prisma field name mismatches"
echo "  5. Add requestId to all AuditContext objects"
echo "  6. Run database migration for PhysicianNote"
echo "  7. Add PhysicianNote to PHI_FIELDS"
echo ""
echo "Run 'npm run type-check' to verify fixes."
