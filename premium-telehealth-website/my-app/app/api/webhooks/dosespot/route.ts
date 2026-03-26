import { NextRequest, NextResponse } from 'next/server';
import { auditLogger } from '@/lib/audit/index';
import { AuditEventType } from '@/lib/audit/types';

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
    
    // Lazy load prisma to avoid build-time initialization issues
    const { prisma } = await import('@/lib/db/prisma');
    
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
      eventType: AuditEventType.PRESCRIPTION_STATUS_UPDATED,
      action: 'WEBHOOK_RECEIVED',
      resourceType: 'Prescription',
      resourceId: prescriptionId,
      ipAddress: request.headers.get('x-forwarded-for') || 'webhook',
      userAgent: request.headers.get('user-agent') || 'DoseSpot',
      metadata: { eventType, status },
    });
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('DoseSpot webhook error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
