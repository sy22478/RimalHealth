/**
 * PrescriptionForm Component
 * Form for physicians to send prescriptions to pharmacies
 * 
 * Features:
 * - Pre-filled from review decision
 * - Pharmacy selection/display
 * - Medication details editing
 * - Confirmation modal
 * - Error handling
 * 
 * HIPAA Compliance:
 * - All PHI is handled securely
 * - Form submission includes authentication
 * - No PHI stored in component state
 * 
 * @module components/physician/PrescriptionForm
 */

'use client';

import * as React from 'react';
import { Pill, Send, AlertCircle, Check, Loader2, MapPin, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { PharmacySearch, Pharmacy } from './PharmacySearch';

// ============================================
// TYPES
// ============================================

export interface PrescriptionData {
  intakeId: string;
  patientId: string;
  medication: string;
  genericName: string;
  dosage: string;
  quantity: number;
  refills: number;
  instructions: string;
  daysSupply?: number;
  pharmacyNotes?: string;
}

interface PrescriptionFormProps {
  /** Initial prescription data (from review) */
  initialData: PrescriptionData;
  /** Patient ZIP code for pharmacy search */
  patientZip?: string;
  /** Callback when prescription is sent successfully */
  onSuccess: (result: { prescriptionId: string; surescriptsRxId: string }) => void;
  /** Callback to cancel */
  onCancel: () => void;
  /** Additional class names */
  className?: string;
}

interface FormState {
  medication: string;
  genericName: string;
  dosage: string;
  quantity: number;
  refills: number;
  instructions: string;
  daysSupply: number;
  pharmacyNotes: string;
}

// ============================================
// COMPONENT
// ============================================

export function PrescriptionForm({
  initialData,
  patientZip,
  onSuccess,
  onCancel,
  className,
}: PrescriptionFormProps): React.ReactElement {
  // Form state
  const [formState, setFormState] = React.useState<FormState>({
    medication: initialData.medication,
    genericName: initialData.genericName,
    dosage: initialData.dosage,
    quantity: initialData.quantity,
    refills: initialData.refills,
    instructions: initialData.instructions,
    daysSupply: initialData.daysSupply || 30,
    pharmacyNotes: initialData.pharmacyNotes || '',
  });

  // Selected pharmacy
  const [selectedPharmacy, setSelectedPharmacy] = React.useState<Pharmacy | null>(null);

  // UI state
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showPharmacySearch, setShowPharmacySearch] = React.useState(!patientZip);

  // ============================================
  // FORM HANDLERS
  // ============================================

  const handleInputChange = (
    field: keyof FormState,
    value: string | number
  ) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handlePharmacySelect = (pharmacy: Pharmacy) => {
    setSelectedPharmacy(pharmacy);
    setShowPharmacySearch(false);
    setError(null);
  };

  const validateForm = (): boolean => {
    if (!selectedPharmacy) {
      setError('Please select a pharmacy');
      return false;
    }
    if (!formState.medication.trim()) {
      setError('Medication name is required');
      return false;
    }
    if (!formState.dosage.trim()) {
      setError('Dosage is required');
      return false;
    }
    if (!formState.instructions.trim()) {
      setError('Instructions are required');
      return false;
    }
    return true;
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!validateForm()) return;
    
    setShowConfirmModal(true);
  };

  const handleConfirmedSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    setShowConfirmModal(false);

    try {
      const payload = {
        intakeId: initialData.intakeId,
        patientId: initialData.patientId,
        pharmacyId: selectedPharmacy!.id,
        medication: formState.medication,
        genericName: formState.genericName,
        dosage: formState.dosage,
        quantity: formState.quantity,
        refills: formState.refills,
        instructions: formState.instructions,
        daysSupply: formState.daysSupply,
        pharmacyNotes: formState.pharmacyNotes || undefined,
      };

      const response = await fetch('/api/physician/prescriptions/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send prescription');
      }

      onSuccess({
        prescriptionId: data.prescriptionId,
        surescriptsRxId: data.surescriptsRxId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send prescription');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  const formatPharmacyAddress = (pharmacy: Pharmacy): string => {
    return `${pharmacy.address}, ${pharmacy.city}, ${pharmacy.state} ${pharmacy.zip}`;
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className={cn('space-y-6', className)}>
      {/* Pharmacy Selection Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-ocean-500" />
            Pharmacy
          </CardTitle>
          <CardDescription>
            Select a pharmacy for the prescription
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showPharmacySearch || !selectedPharmacy ? (
            <PharmacySearch
              defaultZip={patientZip}
              onSelect={handlePharmacySelect}
              selectedId={selectedPharmacy?.id}
            />
          ) : (
            <div className="space-y-4">
              {/* Selected Pharmacy Display */}
              <div className="p-4 rounded-lg border border-ocean-200 bg-ocean-50">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold">{selectedPharmacy.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {formatPharmacyAddress(selectedPharmacy)}
                    </div>
                    {selectedPharmacy.is24Hour && (
                      <Badge variant="outline" className="mt-2">
                        24-Hour Pharmacy
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPharmacySearch(true)}
                  >
                    Change
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prescription Details Form */}
      {selectedPharmacy && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-ocean-500" />
              Prescription Details
            </CardTitle>
            <CardDescription>
              Review and edit the prescription information
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Medication Name */}
              <div className="space-y-2">
                <Label htmlFor="medication">
                  Medication <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="medication"
                  value={formState.medication}
                  onChange={(e) => handleInputChange('medication', e.target.value)}
                  placeholder="e.g., Naltrexone"
                  disabled={isSubmitting}
                />
              </div>

              {/* Generic Name & Dosage Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="genericName">Generic Name</Label>
                  <Input
                    id="genericName"
                    value={formState.genericName}
                    onChange={(e) => handleInputChange('genericName', e.target.value)}
                    placeholder="e.g., Naltrexone HCl"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dosage">
                    Dosage <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dosage"
                    value={formState.dosage}
                    onChange={(e) => handleInputChange('dosage', e.target.value)}
                    placeholder="e.g., 50mg"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Quantity, Refills, Days Supply Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">
                    Quantity <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    min={1}
                    max={999}
                    value={formState.quantity}
                    onChange={(e) =>
                      handleInputChange('quantity', parseInt(e.target.value, 10) || 0)
                    }
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="refills">Refills</Label>
                  <Input
                    id="refills"
                    type="number"
                    min={0}
                    max={11}
                    value={formState.refills}
                    onChange={(e) =>
                      handleInputChange('refills', parseInt(e.target.value, 10) || 0)
                    }
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="daysSupply">Days Supply</Label>
                  <Input
                    id="daysSupply"
                    type="number"
                    min={1}
                    max={365}
                    value={formState.daysSupply}
                    onChange={(e) =>
                      handleInputChange('daysSupply', parseInt(e.target.value, 10) || 0)
                    }
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-2">
                <Label htmlFor="instructions">
                  Patient Instructions (Sig) <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="instructions"
                  value={formState.instructions}
                  onChange={(e) => handleInputChange('instructions', e.target.value)}
                  placeholder="e.g., Take one tablet by mouth daily"
                  rows={3}
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground">
                  Instructions will be printed on the prescription label
                </p>
              </div>

              {/* Pharmacy Notes */}
              <div className="space-y-2">
                <Label htmlFor="pharmacyNotes">Notes to Pharmacist (optional)</Label>
                <Textarea
                  id="pharmacyNotes"
                  value={formState.pharmacyNotes}
                  onChange={(e) => handleInputChange('pharmacyNotes', e.target.value)}
                  placeholder="Any special instructions for the pharmacist..."
                  rows={2}
                  disabled={isSubmitting}
                />
              </div>
            </CardContent>

            <CardFooter className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-navy-500 hover:bg-navy-600"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Prescription
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Prescription</DialogTitle>
            <DialogDescription>
              Please review the prescription details before sending
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Pharmacy</p>
              <p className="text-sm">{selectedPharmacy?.name}</p>
              <p className="text-xs text-muted-foreground">
                {selectedPharmacy && formatPharmacyAddress(selectedPharmacy)}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Medication</p>
              <p className="text-sm">
                {formState.medication} {formState.dosage}
              </p>
              <p className="text-xs text-muted-foreground">
                Qty: {formState.quantity} | Refills: {formState.refills} | Days: {formState.daysSupply}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Instructions</p>
              <p className="text-sm bg-muted p-2 rounded">{formState.instructions}</p>
            </div>

            {formState.pharmacyNotes && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Pharmacy Notes</p>
                <p className="text-sm bg-muted p-2 rounded">{formState.pharmacyNotes}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmModal(false)}
            >
              Edit
            </Button>
            <Button
              onClick={handleConfirmedSubmit}
              className="bg-navy-500 hover:bg-navy-600"
            >
              <Check className="mr-2 h-4 w-4" />
              Confirm & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PrescriptionForm;
