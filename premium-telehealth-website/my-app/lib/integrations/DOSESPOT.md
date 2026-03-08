# DoseSpot e-Prescribing Integration

HIPAA-compliant electronic prescribing integration using DoseSpot API.

## Overview

This integration allows physicians to:
- Search for pharmacies by ZIP code
- Send prescriptions directly to pharmacies via Surescripts
- Track prescription status in real-time
- Cancel prescriptions when needed

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Physician Portal                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │PharmacySearch│  │Prescription  │  │Prescription  │      │
│  │  Component   │  │   Form       │  │   Status     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                      API Routes                             │
│  GET /api/physician/pharmacies/search                       │
│  POST /api/physician/prescriptions/send                     │
│  GET /api/physician/prescriptions/[id]/status               │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                   DoseSpot Client                           │
│              lib/integrations/dosespot.ts                   │
│  - Authentication (OAuth 2.0)                               │
│  - Pharmacy search                                          │
│  - Prescription sending                                     │
│  - Status checking                                          │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│              DoseSpot API / Surescripts                     │
│                    (External)                               │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

```bash
# DoseSpot API Configuration
DOSESPOT_API_URL=https://api-sandbox.dosespot.com  # Sandbox for development
DOSESPOT_CLIENT_ID=your-client-id
DOSESPOT_CLIENT_SECRET=your-client-secret
DOSESPOT_CLINIC_ID=your-clinic-id
DOSESPOT_USER_ID=your-user-id

# Mock mode for development (no real API calls)
DOSESPOT_MOCK_MODE=true

# Timeouts and retries
DOSESPOT_TIMEOUT_MS=30000
DOSESPOT_MAX_RETRIES=3
DOSESPOT_RETRY_DELAY_MS=1000
```

### Mock Mode

For development without DoseSpot credentials:

```bash
DOSESPOT_MOCK_MODE=true
```

In mock mode:
- Pharmacy search returns realistic mock data for California
- Prescription sending simulates API delay and returns mock Rx ID
- Status tracking progresses automatically (SENT → RECEIVED → FILLED)
- No external API calls are made

## Usage

### Pharmacy Search

```typescript
import { PharmacySearch } from '@/components/physician';

function MyComponent() {
  const handlePharmacySelect = (pharmacy) => {
    console.log('Selected:', pharmacy.name);
  };

  return (
    <PharmacySearch
      defaultZip="90210"
      onSelect={handlePharmacySelect}
    />
  );
}
```

### Sending a Prescription

```typescript
import { PrescriptionForm } from '@/components/physician';

function MyComponent() {
  const initialData = {
    intakeId: '...',
    patientId: '...',
    medication: 'Naltrexone',
    genericName: 'Naltrexone HCl',
    dosage: '50mg',
    quantity: 30,
    refills: 5,
    instructions: 'Take one tablet by mouth daily',
  };

  const handleSuccess = (result) => {
    console.log('Prescription sent:', result.surescriptsRxId);
  };

  return (
    <PrescriptionForm
      initialData={initialData}
      patientZip="90210"
      onSuccess={handleSuccess}
      onCancel={() => router.back()}
    />
  );
}
```

### Checking Prescription Status

```typescript
import { PrescriptionStatus } from '@/components/physician';

function MyComponent({ prescriptionId }) {
  return (
    <PrescriptionStatus
      prescriptionId={prescriptionId}
      refreshInterval={30}  // Auto-refresh every 30 seconds
      onStatusChange={(newStatus) => {
        console.log('Status changed:', newStatus);
      }}
    />
  );
}
```

### Direct API Access

```typescript
import { 
  searchPharmacies, 
  sendPrescription,
  checkPrescriptionStatus 
} from '@/lib/integrations/dosespot';

// Search pharmacies
const result = await searchPharmacies({
  zip: '90210',
  name: 'Walgreens',
  radius: 10,
});

// Send prescription
const response = await sendPrescription({
  patientId: '...',
  pharmacyId: '...',
  medication: 'Naltrexone',
  dosage: '50mg',
  quantity: 30,
  refills: 5,
  instructions: 'Take one tablet by mouth daily',
  prescriberNpi: '1234567890',
});

// Check status
const status = await checkPrescriptionStatus('RX123456789');
```

## Prescription Status Flow

```
PENDING → SENT → RECEIVED_BY_PHARMACY → FILLED → READY_FOR_PICKUP → PICKED_UP
   │
   └──→ CANCELLED
   │
   └──→ EXPIRED
   │
   └──→ ERROR
```

| Status | Description |
|--------|-------------|
| `PENDING` | Prescription created but not yet sent |
| `SENT` | Sent to pharmacy via Surescripts |
| `RECEIVED_BY_PHARMACY` | Pharmacy has received the prescription |
| `FILLED` | Pharmacy has filled the prescription |
| `READY_FOR_PICKUP` | Ready for patient pickup |
| `PICKED_UP` | Patient has picked up the prescription |
| `CANCELLED` | Prescription was cancelled |
| `EXPIRED` | Prescription has expired |
| `ERROR` | Error occurred during processing |

## HIPAA Compliance

### Data Handling

1. **PHI Encryption**: All patient data is encrypted at rest and in transit
2. **Audit Logging**: All prescription actions are logged with:
   - Physician ID
   - Patient ID (encrypted)
   - Prescription ID
   - Action timestamp
   - IP address and user agent
3. **No PHI in Logs**: Only IDs are logged, never names or other PHI
4. **Access Control**: Only physicians with `SEND_PRESCRIPTION` permission can send prescriptions

### Audit Log Events

```typescript
// Prescription creation
AuditEventType.PATIENT_DATA_CREATED

// Prescription viewing
AuditEventType.PRESCRIPTION_VIEWED

// Pharmacy search (no PHI)
AuditEventType.PATIENT_DATA_VIEWED
```

## Error Handling

### Common Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| `INVALID_CREDENTIALS` | DoseSpot authentication failed | No |
| `INVALID_PHARMACY` | Pharmacy ID not found | No |
| `PHARMACY_NOT_FOUND` | Pharmacy not in DoseSpot system | No |
| `PRESCRIPTION_VALIDATION_FAILED` | Invalid prescription data | No |
| `SURESCRIPTS_ERROR` | Surescripts network error | Yes |
| `RATE_LIMIT_EXCEEDED` | API rate limit hit | Yes |
| `SERVICE_UNAVAILABLE` | DoseSpot service down | Yes |
| `UNKNOWN_ERROR` | Unexpected error | Maybe |

### Retry Logic

The client automatically retries on retryable errors:
- Exponential backoff: 1s, 2s, 4s
- Maximum 3 retries
- Timeout: 30 seconds per request

## Testing

### Mock Data

Mock mode includes realistic pharmacy data for California:
- Walgreens locations
- CVS Pharmacy locations  
- Rite Aid locations
- Mail order pharmacies (Express Scripts, CVS Caremark)

### Simulated Status Progression

In mock mode, prescription status automatically progresses:
1. `SENT` (immediately)
2. `RECEIVED_BY_PHARMACY` (after 5 seconds)
3. `FILLED` (after 30 seconds)

### Error Simulation

```typescript
import { enableErrorSimulation, disableErrorSimulation } from '@/lib/integrations/dosespot.mock';

// Enable 30% error rate
enableErrorSimulation(0.3);

// Or simulate specific errors
enableErrorSimulation(0.5, DoseSpotErrorCode.SERVICE_UNAVAILABLE);

// Disable error simulation
disableErrorSimulation();
```

## API Reference

See `dosespot.types.ts` for complete TypeScript definitions.

### Key Types

- `DoseSpotPharmacy` - Pharmacy information
- `DoseSpotPrescription` - Prescription data
- `DoseSpotPrescriptionResponse` - Send response
- `DoseSpotStatusResponse` - Status check response
- `PharmacySearchParams` - Search parameters
- `PharmacySearchResponse` - Search results

## Migration to Production

1. Obtain DoseSpot production credentials
2. Update environment variables:
   ```bash
   DOSESPOT_API_URL=https://api.dosespot.com
   DOSESPOT_CLIENT_ID=prod-client-id
   DOSESPOT_CLIENT_SECRET=prod-client-secret
   DOSESPOT_MOCK_MODE=false
   ```
3. Update clinic and user IDs for production
4. Test with a small set of prescriptions
5. Monitor audit logs for any issues

## Support

- DoseSpot Support: https://dosespot.com/support/
- Surescripts Status: https://status.surescripts.com/
- Internal: Contact engineering team for credential issues
