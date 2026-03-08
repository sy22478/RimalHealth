/**
 * DoseSpot Mock Implementation
 * Simulates DoseSpot API for development without real credentials
 * 
 * Features:
 * - Realistic pharmacy data for California
 * - Simulated prescription sending with delay
 * - Status tracking that progresses over time
 * - Error simulation for testing
 * 
 * @module lib/integrations/dosespot.mock
 */

import {
  DoseSpotPharmacy,
  DoseSpotPrescription,
  DoseSpotPrescriptionResponse,
  DoseSpotStatusResponse,
  PharmacySearchParams,
  PharmacySearchResponse,
  DoseSpotRxStatus,
  DoseSpotErrorCode,
  PharmacyType,
  DoseSpotMedication,
  MedicationSearchParams,
} from './dosespot.types';

// ============================================
// MOCK DATA - CALIFORNIA PHARMACIES
// ============================================

const MOCK_PHARMACIES: DoseSpotPharmacy[] = [
  // Los Angeles Area
  {
    id: 'walgreens-la-001',
    name: 'Walgreens Pharmacy',
    address: '1234 Sunset Blvd',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90026',
    phone: '(323) 555-0100',
    ncpdpId: '0563456',
    type: PharmacyType.RETAIL,
    is24Hour: true,
    isActive: true,
  },
  {
    id: 'walgreens-la-002',
    name: 'Walgreens Pharmacy',
    address: '5678 Hollywood Blvd',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90028',
    phone: '(323) 555-0101',
    ncpdpId: '0563457',
    type: PharmacyType.RETAIL,
    is24Hour: false,
    isActive: true,
  },
  {
    id: 'cvs-la-001',
    name: 'CVS Pharmacy',
    address: '901 Vermont Ave',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90029',
    phone: '(323) 555-0200',
    ncpdpId: '0563890',
    type: PharmacyType.RETAIL,
    is24Hour: true,
    isActive: true,
  },
  {
    id: 'cvs-la-002',
    name: 'CVS Pharmacy',
    address: '2345 Santa Monica Blvd',
    city: 'Santa Monica',
    state: 'CA',
    zip: '90404',
    phone: '(310) 555-0201',
    ncpdpId: '0563891',
    type: PharmacyType.RETAIL,
    is24Hour: false,
    isActive: true,
  },
  {
    id: 'riteaid-la-001',
    name: "Rite Aid Pharmacy",
    address: '3456 Wilshire Blvd',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90010',
    phone: '(213) 555-0300',
    ncpdpId: '0564123',
    type: PharmacyType.RETAIL,
    is24Hour: false,
    isActive: true,
  },
  {
    id: 'costco-la-001',
    name: 'Costco Pharmacy',
    address: '4567 Venice Blvd',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90019',
    phone: '(323) 555-0400',
    ncpdpId: '0564567',
    type: PharmacyType.RETAIL,
    is24Hour: false,
    isActive: true,
  },
  // San Francisco Area
  {
    id: 'walgreens-sf-001',
    name: 'Walgreens Pharmacy',
    address: '789 Market St',
    city: 'San Francisco',
    state: 'CA',
    zip: '94103',
    phone: '(415) 555-0100',
    ncpdpId: '0566789',
    type: PharmacyType.RETAIL,
    is24Hour: true,
    isActive: true,
  },
  {
    id: 'cvs-sf-001',
    name: 'CVS Pharmacy',
    address: '123 Castro St',
    city: 'San Francisco',
    state: 'CA',
    zip: '94114',
    phone: '(415) 555-0200',
    ncpdpId: '0567890',
    type: PharmacyType.RETAIL,
    is24Hour: false,
    isActive: true,
  },
  {
    id: 'riteaid-sf-001',
    name: "Rite Aid Pharmacy",
    address: '456 Mission St',
    city: 'San Francisco',
    state: 'CA',
    zip: '94105',
    phone: '(415) 555-0300',
    ncpdpId: '0568901',
    type: PharmacyType.RETAIL,
    is24Hour: false,
    isActive: true,
  },
  // San Diego Area
  {
    id: 'walgreens-sd-001',
    name: 'Walgreens Pharmacy',
    address: '321 Garnet Ave',
    city: 'San Diego',
    state: 'CA',
    zip: '92109',
    phone: '(858) 555-0100',
    ncpdpId: '0569012',
    type: PharmacyType.RETAIL,
    is24Hour: true,
    isActive: true,
  },
  {
    id: 'cvs-sd-001',
    name: 'CVS Pharmacy',
    address: '654 Grand Ave',
    city: 'San Diego',
    state: 'CA',
    zip: '92109',
    phone: '(858) 555-0200',
    ncpdpId: '0569123',
    type: PharmacyType.RETAIL,
    is24Hour: false,
    isActive: true,
  },
  {
    id: 'riteaid-sd-001',
    name: "Rite Aid Pharmacy",
    address: '987 El Cajon Blvd',
    city: 'San Diego',
    state: 'CA',
    zip: '92115',
    phone: '(619) 555-0300',
    ncpdpId: '0569234',
    type: PharmacyType.RETAIL,
    is24Hour: false,
    isActive: true,
  },
  // Sacramento Area
  {
    id: 'walgreens-sac-001',
    name: 'Walgreens Pharmacy',
    address: '100 Capitol Mall',
    city: 'Sacramento',
    state: 'CA',
    zip: '95814',
    phone: '(916) 555-0100',
    ncpdpId: '0569345',
    type: PharmacyType.RETAIL,
    is24Hour: false,
    isActive: true,
  },
  {
    id: 'cvs-sac-001',
    name: 'CVS Pharmacy',
    address: '200 J St',
    city: 'Sacramento',
    state: 'CA',
    zip: '95814',
    phone: '(916) 555-0200',
    ncpdpId: '0569456',
    type: PharmacyType.RETAIL,
    is24Hour: true,
    isActive: true,
  },
  // San Jose Area
  {
    id: 'walgreens-sj-001',
    name: 'Walgreens Pharmacy',
    address: '300 Santana Row',
    city: 'San Jose',
    state: 'CA',
    zip: '95128',
    phone: '(408) 555-0100',
    ncpdpId: '0569567',
    type: PharmacyType.RETAIL,
    is24Hour: false,
    isActive: true,
  },
  {
    id: 'cvs-sj-001',
    name: 'CVS Pharmacy',
    address: '400 Stevens Creek Blvd',
    city: 'San Jose',
    state: 'CA',
    zip: '95129',
    phone: '(408) 555-0200',
    ncpdpId: '0569678',
    type: PharmacyType.RETAIL,
    is24Hour: false,
    isActive: true,
  },
  // Mail Order
  {
    id: 'express-scripts-001',
    name: 'Express Scripts Pharmacy',
    address: '1 Express Way',
    city: 'St. Louis',
    state: 'MO',
    zip: '63121',
    phone: '(800) 555-1000',
    ncpdpId: '0999888',
    type: PharmacyType.MAIL_ORDER,
    is24Hour: false,
    isActive: true,
  },
  {
    id: 'cvs-caremark-001',
    name: 'CVS Caremark Mail Service',
    address: '1 CVS Way',
    city: 'Woonsocket',
    state: 'RI',
    zip: '02895',
    phone: '(800) 555-2000',
    ncpdpId: '0999777',
    type: PharmacyType.MAIL_ORDER,
    is24Hour: false,
    isActive: true,
  },
];

// ============================================
// MOCK MEDICATIONS
// ============================================

const MOCK_MEDICATIONS: DoseSpotMedication[] = [
  {
    id: 'med-naltrexone-001',
    name: 'Vivitrol',
    genericName: 'Naltrexone',
    strengths: ['50mg', '380mg injection'],
    forms: ['Tablet', 'Injection'],
    deaSchedule: undefined,
    requiresPriorAuth: false,
  },
  {
    id: 'med-naltrexone-002',
    name: 'Naltrexone',
    genericName: 'Naltrexone HCl',
    strengths: ['50mg'],
    forms: ['Tablet'],
    deaSchedule: undefined,
    requiresPriorAuth: false,
  },
  {
    id: 'med-disulfiram-001',
    name: 'Antabuse',
    genericName: 'Disulfiram',
    strengths: ['250mg', '500mg'],
    forms: ['Tablet'],
    deaSchedule: undefined,
    requiresPriorAuth: false,
  },
  {
    id: 'med-acamprosate-001',
    name: 'Campral',
    genericName: 'Acamprosate Calcium',
    strengths: ['333mg'],
    forms: ['Delayed-release tablet'],
    deaSchedule: undefined,
    requiresPriorAuth: false,
  },
  {
    id: 'med-varenicline-001',
    name: 'Chantix',
    genericName: 'Varenicline Tartrate',
    strengths: ['0.5mg', '1mg'],
    forms: ['Tablet'],
    deaSchedule: undefined,
    requiresPriorAuth: false,
  },
  {
    id: 'med-bupropion-001',
    name: 'Zyban',
    genericName: 'Bupropion HCl',
    strengths: ['150mg'],
    forms: ['Extended-release tablet'],
    deaSchedule: undefined,
    requiresPriorAuth: false,
  },
];

// ============================================
// PRESCRIPTION STATUS STORE
// ============================================

interface MockPrescriptionStatus {
  rxId: string;
  status: DoseSpotRxStatus;
  createdAt: Date;
  statusHistory: Array<{ status: DoseSpotRxStatus; timestamp: Date; details?: string }>;
  prescription: DoseSpotPrescription;
}

// In-memory store for prescription statuses
const prescriptionStore = new Map<string, MockPrescriptionStatus>();

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculate distance between two ZIP codes (simplified mock)
 * In real implementation, this would use geocoding
 */
function calculateDistance(zip1: string, zip2: string): number {
  // Mock distance calculation - returns pseudo-random distance based on ZIP codes
  const baseDistance = Math.abs(parseInt(zip1.slice(0, 3)) - parseInt(zip2.slice(0, 3)));
  return Math.round((baseDistance * 0.5 + Math.random() * 5) * 10) / 10;
}

/**
 * Generate a unique Rx ID
 */
function generateRxId(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `RX${timestamp}${random}`;
}

/**
 * Simulate API delay
 */
function simulateDelay(ms: number = 500): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// MOCK API FUNCTIONS
// ============================================

/**
 * Search for pharmacies (mock implementation)
 */
export async function mockSearchPharmacies(
  params: PharmacySearchParams
): Promise<PharmacySearchResponse> {
  await simulateDelay(300 + Math.random() * 400); // 300-700ms delay

  const { zip, name, radius = 10, limit = 20, type, includeInactive = false } = params;

  // Validate ZIP code format
  if (!/^\d{5}(-\d{4})?$/.test(zip)) {
    return {
      success: false,
      pharmacies: [],
      error: 'Invalid ZIP code format',
      errorCode: DoseSpotErrorCode.INVALID_PHARMACY,
    };
  }

  // Filter pharmacies
  let results = MOCK_PHARMACIES.filter(pharmacy => {
    // Filter by active status
    if (!includeInactive && !pharmacy.isActive) {
      return false;
    }

    // Filter by type
    if (type && pharmacy.type !== type) {
      return false;
    }

    // Filter by name if provided
    if (name) {
      const searchName = name.toLowerCase();
      const pharmacyName = pharmacy.name.toLowerCase();
      if (!pharmacyName.includes(searchName)) {
        return false;
      }
    }

    // Include California pharmacies and mail order
    return pharmacy.state === 'CA' || pharmacy.type === PharmacyType.MAIL_ORDER;
  });

  // Calculate distances and sort
  results = results.map(pharmacy => ({
    ...pharmacy,
    distance: calculateDistance(zip, pharmacy.zip),
  }));

  // Sort by distance
  results.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));

  // Filter by radius
  results = results.filter(pharmacy => (pharmacy.distance || 0) <= radius);

  // Apply limit
  results = results.slice(0, limit);

  return {
    success: true,
    pharmacies: results,
    totalCount: results.length,
  };
}

/**
 * Send prescription (mock implementation)
 */
export async function mockSendPrescription(
  prescription: DoseSpotPrescription
): Promise<DoseSpotPrescriptionResponse> {
  await simulateDelay(800 + Math.random() * 700); // 800-1500ms delay

  // Validate required fields
  if (!prescription.patientId || !prescription.pharmacyId || !prescription.medication) {
    return {
      success: false,
      error: 'Missing required fields',
      errorCode: DoseSpotErrorCode.PRESCRIPTION_VALIDATION_FAILED,
      validationErrors: ['patientId, pharmacyId, and medication are required'],
    };
  }

  // Validate pharmacy exists
  const pharmacy = MOCK_PHARMACIES.find(p => p.id === prescription.pharmacyId);
  if (!pharmacy) {
    return {
      success: false,
      error: 'Pharmacy not found',
      errorCode: DoseSpotErrorCode.PHARMACY_NOT_FOUND,
    };
  }

  // Generate Rx ID
  const rxId = generateRxId();

  // Store prescription status
  const statusEntry: MockPrescriptionStatus = {
    rxId,
    status: DoseSpotRxStatus.SENT,
    createdAt: new Date(),
    statusHistory: [
      {
        status: DoseSpotRxStatus.SENT,
        timestamp: new Date(),
        details: 'Prescription sent to pharmacy via Surescripts',
      },
    ],
    prescription,
  };

  prescriptionStore.set(rxId, statusEntry);

  // Simulate status progression (in real app, this would be handled by webhooks)
  simulateStatusProgression(rxId);

  return {
    success: true,
    rxId,
    status: DoseSpotRxStatus.SENT,
    sentAt: new Date().toISOString(),
  };
}

/**
 * Check prescription status (mock implementation)
 */
export async function mockCheckStatus(rxId: string): Promise<DoseSpotStatusResponse> {
  await simulateDelay(200 + Math.random() * 300); // 200-500ms delay

  const statusEntry = prescriptionStore.get(rxId);

  if (!statusEntry) {
    return {
      success: false,
      status: DoseSpotRxStatus.ERROR,
      rxId,
      error: 'Prescription not found',
      errorCode: DoseSpotErrorCode.UNKNOWN_ERROR,
    };
  }

  return {
    success: true,
    status: statusEntry.status,
    rxId,
    statusHistory: statusEntry.statusHistory.map(h => ({
      status: h.status,
      timestamp: h.timestamp.toISOString(),
      details: h.details,
    })),
  };
}

/**
 * Search medications (mock implementation)
 */
export async function mockSearchMedications(
  params: MedicationSearchParams
): Promise<{ success: boolean; medications: DoseSpotMedication[]; error?: string }> {
  await simulateDelay(300 + Math.random() * 200);

  const { query, limit = 10 } = params;
  const searchQuery = query.toLowerCase();

  const results = MOCK_MEDICATIONS.filter(
    med =>
      med.name.toLowerCase().includes(searchQuery) ||
      med.genericName.toLowerCase().includes(searchQuery)
  ).slice(0, limit);

  return {
    success: true,
    medications: results,
  };
}

/**
 * Cancel prescription (mock implementation)
 */
export async function mockCancelPrescription(
  rxId: string,
  reason?: string
): Promise<{ success: boolean; error?: string; errorCode?: DoseSpotErrorCode }> {
  await simulateDelay(400 + Math.random() * 300);

  const statusEntry = prescriptionStore.get(rxId);

  if (!statusEntry) {
    return {
      success: false,
      error: 'Prescription not found',
      errorCode: DoseSpotErrorCode.UNKNOWN_ERROR,
    };
  }

  // Cannot cancel if already filled
  if (statusEntry.status === DoseSpotRxStatus.FILLED || 
      statusEntry.status === DoseSpotRxStatus.PICKED_UP) {
    return {
      success: false,
      error: 'Cannot cancel prescription that has already been filled',
      errorCode: DoseSpotErrorCode.PRESCRIPTION_VALIDATION_FAILED,
    };
  }

  // Update status
  statusEntry.status = DoseSpotRxStatus.CANCELLED;
  statusEntry.statusHistory.push({
    status: DoseSpotRxStatus.CANCELLED,
    timestamp: new Date(),
    details: reason || 'Prescription cancelled by prescriber',
  });

  return {
    success: true,
  };
}

// ============================================
// STATUS SIMULATION
// ============================================

/**
 * Simulate prescription status progression
 * In real app, this would be driven by Surescripts status updates
 */
function simulateStatusProgression(rxId: string): void {
  const statusEntry = prescriptionStore.get(rxId);
  if (!statusEntry) return;

  const transitions: Array<{ status: DoseSpotRxStatus; delay: number; details: string }> = [
    { status: DoseSpotRxStatus.RECEIVED_BY_PHARMACY, delay: 5000, details: 'Prescription received by pharmacy' },
    { status: DoseSpotRxStatus.FILLED, delay: 30000, details: 'Prescription filled and ready for pickup' },
  ];

  let accumulatedDelay = 0;

  for (const transition of transitions) {
    accumulatedDelay += transition.delay;
    
    setTimeout(() => {
      const entry = prescriptionStore.get(rxId);
      if (entry && entry.status !== DoseSpotRxStatus.CANCELLED) {
        entry.status = transition.status;
        entry.statusHistory.push({
          status: transition.status,
          timestamp: new Date(),
          details: transition.details,
        });
      }
    }, accumulatedDelay);
  }
}

// ============================================
// ERROR SIMULATION
// ============================================

/**
 * Configuration for error simulation (for testing)
 */
interface ErrorSimulationConfig {
  enabled: boolean;
  errorRate: number; // 0-1
  errorCode?: DoseSpotErrorCode;
}

let errorSimulation: ErrorSimulationConfig = {
  enabled: false,
  errorRate: 0,
};

/**
 * Enable error simulation for testing
 */
export function enableErrorSimulation(errorRate: number = 0.3, errorCode?: DoseSpotErrorCode): void {
  errorSimulation = {
    enabled: true,
    errorRate,
    errorCode,
  };
}

/**
 * Disable error simulation
 */
export function disableErrorSimulation(): void {
  errorSimulation = {
    enabled: false,
    errorRate: 0,
  };
}

/**
 * Check if should simulate error
 */
function shouldSimulateError(): DoseSpotErrorCode | null {
  if (!errorSimulation.enabled) return null;
  if (Math.random() > errorSimulation.errorRate) return null;
  
  return errorSimulation.errorCode || DoseSpotErrorCode.UNKNOWN_ERROR;
}

// ============================================
// STORE MANAGEMENT
// ============================================

/**
 * Get all prescriptions from mock store (for debugging)
 */
export function getMockPrescriptions(): MockPrescriptionStatus[] {
  return Array.from(prescriptionStore.values());
}

/**
 * Clear mock store (for testing)
 */
export function clearMockStore(): void {
  prescriptionStore.clear();
}

/**
 * Get prescription by ID
 */
export function getMockPrescription(rxId: string): MockPrescriptionStatus | undefined {
  return prescriptionStore.get(rxId);
}

// ============================================
// MOCK CLIENT EXPORT
// ============================================

/**
 * Mock DoseSpot client
 * Drop-in replacement for real DoseSpot client in development
 */
export const mockDoseSpotClient = {
  searchPharmacies: mockSearchPharmacies,
  sendPrescription: mockSendPrescription,
  checkStatus: mockCheckStatus,
  searchMedications: mockSearchMedications,
  cancelPrescription: mockCancelPrescription,
  
  // Testing utilities
  enableErrorSimulation,
  disableErrorSimulation,
  getMockPrescriptions,
  clearMockStore,
  getMockPrescription,
};

export default mockDoseSpotClient;
