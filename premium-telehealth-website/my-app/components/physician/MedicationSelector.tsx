'use client';

import * as React from 'react';
import { AlertCircle, Pill, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  MEDICATION_OPTIONS,
  MedicationOption,
  checkContraindications,
  getMedicationsForConcern,
} from '@/lib/physician/review-types';
import { IntakeFormData } from '@/types/intake';

export interface MedicationSelection {
  name: string;
  genericName: string;
  dosage: string;
  quantity: number;
  refills: number;
  instructions: string;
}

interface MedicationSelectorProps {
  value: MedicationSelection | null;
  onChange: (value: MedicationSelection) => void;
  concernType: string;
  formData: IntakeFormData;
  disabled?: boolean;
}

/**
 * Medication Selector Component
 * 
 * Allows physicians to select and configure medication for approved intakes.
 * Shows contraindications based on patient medical history.
 * 
 * HIPAA: Medication selections are part of the medical record
 */
export function MedicationSelector({
  value,
  onChange,
  concernType,
  formData,
  disabled = false,
}: MedicationSelectorProps) {
  // Get medications appropriate for the concern type. Only ALCOHOL options
  // exist today; WEIGHT_MANAGEMENT (GLP-1) options arrive in Phase 3.
  const availableMedications = React.useMemo(() => {
    return getMedicationsForConcern(concernType);
  }, [concernType]);

  // Get selected medication details
  const selectedMed = React.useMemo(() => {
    if (!value) return null;
    return MEDICATION_OPTIONS.find((med) => med.name === value.name);
  }, [value]);

  // Check for contraindications
  const contraindications = React.useMemo(() => {
    if (!selectedMed) return [];
    return checkContraindications(selectedMed, formData);
  }, [selectedMed, formData]);

  const hasContraindications = contraindications.length > 0;

  // Handle medication selection
  const handleMedicationSelect = (medication: MedicationOption) => {
    onChange({
      name: medication.name,
      genericName: medication.genericName,
      dosage: medication.defaultDosage,
      quantity: medication.defaultQuantity,
      refills: medication.defaultRefills,
      instructions: medication.defaultInstructions,
    });
  };

  // Handle field changes
  const handleFieldChange = (field: keyof MedicationSelection, fieldValue: string | number) => {
    if (!value) return;
    onChange({
      ...value,
      [field]: fieldValue,
    });
  };

  return (
    <div className="space-y-6">
      {/* Contraindication Warnings */}
      {hasContraindications && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Contraindications Detected</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc list-inside space-y-1">
              {contraindications.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Medication Selection Grid */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          Select Medication
          <span className="text-destructive ml-1">*</span>
        </Label>
        <div className="grid grid-cols-1 gap-3">
          {availableMedications.map((med) => (
            <button
              key={med.name}
              type="button"
              onClick={() => handleMedicationSelect(med)}
              disabled={disabled}
              className={cn(
                'relative text-left p-4 rounded-lg border-2 transition-all',
                value?.name === med.name
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-accent',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="flex items-start gap-3">
                <Pill className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm break-words">{med.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {med.genericName}
                  </p>
                  <Badge variant="secondary" className="mt-2 text-xs">
                    {med.category === 'ALCOHOL'
                      ? 'Alcohol'
                      : med.category === 'WEIGHT_MANAGEMENT'
                        ? 'Weight Management'
                        : 'Other'}
                  </Badge>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Medication Configuration */}
      {selectedMed && value && (
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Pill className="h-4 w-4" />
              {selectedMed.name} Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dosage Selection */}
            <div className="space-y-2">
              <Label htmlFor="dosage">Dosage</Label>
              <select
                id="dosage"
                value={value.dosage}
                onChange={(e) => handleFieldChange('dosage', e.target.value)}
                disabled={disabled}
                className={cn(
                  'w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                {selectedMed.dosages.map((dosage) => (
                  <option key={dosage} value={dosage}>
                    {dosage}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity and Refills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  max={365}
                  value={value.quantity}
                  onChange={(e) =>
                    handleFieldChange('quantity', Math.min(Math.max(parseInt(e.target.value) || 0, 1), 365))
                  }
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="refills">Refills</Label>
                <Input
                  id="refills"
                  type="number"
                  min={0}
                  max={12}
                  value={value.refills}
                  onChange={(e) =>
                    handleFieldChange('refills', Math.min(Math.max(parseInt(e.target.value) || 0, 0), 12))
                  }
                  disabled={disabled}
                />
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-2">
              <Label htmlFor="instructions">
                Instructions
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Textarea
                id="instructions"
                value={value.instructions}
                onChange={(e) => handleFieldChange('instructions', e.target.value)}
                placeholder="Enter patient instructions..."
                disabled={disabled}
                className="min-h-[100px]"
              />
            </div>

            <Separator />

            {/* Warnings */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 break-words">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-medium text-amber-900">Important Warnings</p>
                  <ul className="text-xs text-amber-800 list-disc list-inside space-y-0.5 break-words">
                    {selectedMed.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
