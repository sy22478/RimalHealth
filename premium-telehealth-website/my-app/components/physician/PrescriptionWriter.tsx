/**
 * PrescriptionWriter Component
 * 
 * Form for writing prescriptions with medication search,
 * dosage selection, and pharmacy selection.
 * 
 * @module components/physician/PrescriptionWriter
 */

'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Search,
  Pill,
  MapPin,
  ChevronDown,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { ReviewPrescription, MedicationOption, PharmacyOption } from '@/types/physician-dashboard';

// ============================================================================
// Validation Schema
// ============================================================================

const prescriptionSchema = z.object({
  medicationName: z.string().min(1, 'Medication is required'),
  genericName: z.string().optional(),
  dosage: z.string().min(1, 'Dosage is required'),
  frequency: z.string().min(1, 'Frequency is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  refills: z.number().min(0, 'Refills cannot be negative').max(11, 'Max 11 refills'),
  instructions: z.string().optional(),
  pharmacyId: z.string().optional(),
});

type PrescriptionFormValues = z.infer<typeof prescriptionSchema>;

// ============================================================================
// Medication Database
// ============================================================================

const medicationDatabase: MedicationOption[] = [
  // Alcohol Use Disorder
  {
    id: 'naltrexone-50',
    name: 'Naltrexone',
    genericName: 'Naltrexone HCl',
    dosages: ['25mg', '50mg', '100mg'],
    frequencies: ['Once daily', 'Twice daily', 'Every other day'],
    quantities: [30, 60, 90],
    maxRefills: 5,
    drugClass: 'Opioid Antagonist',
  },
  {
    id: 'acamprosate-333',
    name: 'Campral',
    genericName: 'Acamprosate Calcium',
    dosages: ['333mg'],
    frequencies: ['Two tablets three times daily', 'Two tablets twice daily'],
    quantities: [180, 360],
    maxRefills: 5,
    drugClass: 'GABA Agonist/Glutamate Antagonist',
  },
  {
    id: 'disulfiram-250',
    name: 'Antabuse',
    genericName: 'Disulfiram',
    dosages: ['250mg', '500mg'],
    frequencies: ['Once daily'],
    quantities: [30, 60, 90],
    maxRefills: 5,
    drugClass: 'Alcohol Deterrent',
  },
];

// ============================================================================
// Props Interface
// ============================================================================

interface PrescriptionWriterProps {
  /** Initial values for editing */
  initialValues?: Partial<ReviewPrescription>;
  /** Save handler */
  onSave: (prescription: ReviewPrescription) => void;
  /** Cancel handler */
  onCancel: () => void;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * PrescriptionWriter for creating new prescriptions
 * 
 * @example
 * ```tsx
 * <PrescriptionWriter
 *   onSave={(rx) => console.log('Saved:', rx)}
 *   onCancel={() => setShowWriter(false)}
 * />
 * ```
 */
export function PrescriptionWriter({
  initialValues,
  onSave,
  onCancel,
  className,
}: PrescriptionWriterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedication, setSelectedMedication] = useState<MedicationOption | null>(null);
  const [showMedicationSearch, setShowMedicationSearch] = useState(true);

  // Pharmacy state - fetched from real API
  const [pharmacies, setPharmacies] = useState<PharmacyOption[]>([]);
  const [pharmacySearchZip, setPharmacySearchZip] = useState('');
  const [isLoadingPharmacies, setIsLoadingPharmacies] = useState(false);
  const [pharmacyError, setPharmacyError] = useState<string | null>(null);

  // Fetch pharmacies from the real API
  const searchPharmacies = async (zip: string): Promise<void> => {
    if (!/^\d{5}(-\d{4})?$/.test(zip)) {
      setPharmacyError('Please enter a valid ZIP code');
      return;
    }

    setIsLoadingPharmacies(true);
    setPharmacyError(null);

    try {
      const params = new URLSearchParams({ zip, radius: '10', limit: '20' });
      const response = await fetch(`/api/physician/pharmacies/search?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to search pharmacies');
      }

      const data = await response.json();
      const results: PharmacyOption[] = (data.pharmacies || []).map(
        (p: { id: string; name: string; address: string; city?: string; state?: string; zip?: string; phone?: string; ncpdpId: string }) => ({
          id: p.id,
          name: p.name,
          address: p.city ? `${p.address}, ${p.city}, ${p.state} ${p.zip}` : p.address,
          phone: p.phone || '',
          ncpdpId: p.ncpdpId,
        })
      );

      setPharmacies(results);

      if (results.length === 0) {
        setPharmacyError('No pharmacies found. Try a different ZIP code.');
      }
    } catch (err) {
      setPharmacyError(err instanceof Error ? err.message : 'Failed to search pharmacies');
    } finally {
      setIsLoadingPharmacies(false);
    }
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PrescriptionFormValues>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: {
      medicationName: initialValues?.medicationName || '',
      dosage: initialValues?.dosage || '',
      frequency: initialValues?.frequency || '',
      quantity: initialValues?.quantity || 30,
      refills: initialValues?.refills || 0,
      instructions: initialValues?.instructions || '',
    },
  });

  // Filter medications based on search
  const filteredMedications = useMemo(() => {
    if (!searchQuery) return medicationDatabase;
    const query = searchQuery.toLowerCase();
    return medicationDatabase.filter(
      (med) =>
        med.name.toLowerCase().includes(query) ||
        med.genericName.toLowerCase().includes(query) ||
        med.drugClass.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Select a medication
  const handleMedicationSelect = (medication: MedicationOption) => {
    setSelectedMedication(medication);
    setValue('medicationName', medication.name);
    setValue('genericName', medication.genericName);
    // Set defaults
    setValue('dosage', medication.dosages[0]);
    setValue('frequency', medication.frequencies[0]);
    setValue('quantity', medication.quantities[0]);
    setShowMedicationSearch(false);
  };

  // Form submission
  const onSubmit = (values: PrescriptionFormValues) => {
    const pharmacy = pharmacies.find((p) => p.id === values.pharmacyId);
    onSave({
      ...values,
      pharmacyName: pharmacy?.name,
    });
  };

  const quantity = watch('quantity');
  const refills = watch('refills');
  const dosage = watch('dosage');
  const frequency = watch('frequency');
  const pharmacyId = watch('pharmacyId');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={cn('space-y-6', className)}>
      {/* Medication Selection */}
      {showMedicationSearch ? (
        <div className="space-y-4">
          <Label>Search Medication</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, generic name, or drug class..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="grid gap-2 max-h-64 overflow-y-auto">
            {filteredMedications.map((med) => (
              <button
                key={med.id}
                type="button"
                onClick={() => handleMedicationSelect(med)}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted text-left transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Pill className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{med.name}</p>
                  <p className="text-sm text-muted-foreground">{med.genericName}</p>
                  <p className="text-xs text-muted-foreground mt-1">{med.drugClass}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Pill className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">{selectedMedication?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedMedication?.genericName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedMedication(null);
                  setShowMedicationSearch(true);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prescription Details */}
      {!showMedicationSearch && selectedMedication && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dosage">Dosage</Label>
              <Select
                value={dosage}
                onValueChange={(value) => setValue('dosage', value)}
              >
                <SelectTrigger id="dosage" className="mt-1.5">
                  <SelectValue placeholder="Select dosage" />
                </SelectTrigger>
                <SelectContent>
                  {selectedMedication.dosages.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="frequency">Frequency</Label>
              <Select
                value={frequency}
                onValueChange={(value) => setValue('frequency', value)}
              >
                <SelectTrigger id="frequency" className="mt-1.5">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  {selectedMedication.frequencies.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Select
                value={quantity?.toString()}
                onValueChange={(value) => setValue('quantity', parseInt(value))}
              >
                <SelectTrigger id="quantity" className="mt-1.5">
                  <SelectValue placeholder="Select quantity" />
                </SelectTrigger>
                <SelectContent>
                  {selectedMedication.quantities.map((q) => (
                    <SelectItem key={q} value={q.toString()}>
                      {q} tablets/patches
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="refills">Refills</Label>
              <Select
                value={refills?.toString()}
                onValueChange={(value) => setValue('refills', parseInt(value))}
              >
                <SelectTrigger id="refills" className="mt-1.5">
                  <SelectValue placeholder="Select refills" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: selectedMedication.maxRefills + 1 }, (_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {i} {i === 1 ? 'refill' : 'refills'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="instructions">Special Instructions</Label>
            <Textarea
              id="instructions"
              {...register('instructions')}
              placeholder="Enter any special instructions (e.g., take with food, avoid alcohol)..."
              className="min-h-[80px] mt-1.5"
            />
          </div>

          {/* Pharmacy Selection */}
          <div>
            <Label>Pharmacy</Label>

            {/* ZIP Code Search */}
            <div className="flex items-center gap-2 mt-1.5 mb-3">
              <Input
                placeholder="Enter ZIP code to search pharmacies..."
                value={pharmacySearchZip}
                onChange={(e) => setPharmacySearchZip(e.target.value)}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    searchPharmacies(pharmacySearchZip);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => searchPharmacies(pharmacySearchZip)}
                disabled={isLoadingPharmacies}
              >
                {isLoadingPharmacies ? (
                  <span className="animate-spin mr-1">...</span>
                ) : (
                  <Search className="w-4 h-4 mr-1" />
                )}
                Search
              </Button>
            </div>

            {pharmacyError && (
              <div className="flex items-center gap-2 text-sm text-red-600 mb-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pharmacyError}</span>
              </div>
            )}

            {pharmacies.length === 0 && !pharmacyError && !isLoadingPharmacies && (
              <p className="text-sm text-muted-foreground mb-3">
                Enter a ZIP code above to search for nearby pharmacies.
              </p>
            )}

            <div className="grid gap-2 max-h-64 overflow-y-auto">
              {pharmacies.map((pharmacy) => (
                <button
                  key={pharmacy.id}
                  type="button"
                  onClick={() => setValue('pharmacyId', pharmacy.id)}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border text-left transition-colors',
                    pharmacyId === pharmacy.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted'
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{pharmacy.name}</span>
                      {pharmacyId === pharmacy.id && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{pharmacy.address}</p>
                    {pharmacy.phone && (
                      <p className="text-sm text-muted-foreground">{pharmacy.phone}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <Card className="bg-muted/50">
            <CardContent className="p-4 space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">Prescription Preview</h4>
              <div className="space-y-1">
                <p className="font-semibold">
                  {selectedMedication.name} {dosage}
                </p>
                <p className="text-sm">{frequency}</p>
                <p className="text-sm">Quantity: {quantity}</p>
                <p className="text-sm">Refills: {refills}</p>
                {watch('instructions') && (
                  <p className="text-sm text-muted-foreground italic">
                    &ldquo;{watch('instructions')}&rdquo;
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={showMedicationSearch || !selectedMedication}>
          Save Prescription
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// Compact Prescription Display
// ============================================================================

interface PrescriptionDisplayProps {
  prescription: ReviewPrescription;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

/**
 * Compact display for a prescription
 */
export function PrescriptionDisplay({
  prescription,
  onEdit,
  onDelete,
  className,
}: PrescriptionDisplayProps) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Pill className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold">{prescription.medicationName}</p>
              <p className="text-sm text-muted-foreground">
                {prescription.dosage} • {prescription.frequency}
              </p>
              <p className="text-sm text-muted-foreground">
                Qty: {prescription.quantity} • Refills: {prescription.refills}
              </p>
              {prescription.pharmacyName && (
                <p className="text-xs text-muted-foreground mt-1">
                  {prescription.pharmacyName}
                </p>
              )}
            </div>
          </div>
          {(onEdit || onDelete) && (
            <div className="flex items-center gap-1">
              {onEdit && (
                <Button variant="ghost" size="sm" onClick={onEdit}>
                  Edit
                </Button>
              )}
              {onDelete && (
                <Button variant="ghost" size="sm" onClick={onDelete}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
        </div>
        {prescription.instructions && (
          <p className="text-sm text-muted-foreground mt-3 italic">
            &ldquo;{prescription.instructions}&rdquo;
          </p>
        )}
      </CardContent>
    </Card>
  );
}
