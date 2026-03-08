'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Shield, UserCircle, Database, Lock, Eye, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingButton } from '@/components/ui/LoadingButton';

// ============================================================================
// Types
// ============================================================================

interface PreferencesData {
  emailNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
  appointmentReminders: boolean;
  prescriptionAlerts: boolean;
  messageAlerts: boolean;
  profileVisibility: 'PRIVATE' | 'PROVIDERS_ONLY';
  shareDataForResearch: boolean;
}

interface PrivacySettingsProps {
  preferences: PreferencesData | null;
  onUpdate: (preferences: PreferencesData) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function PrivacySettings({ 
  preferences, 
  onUpdate 
}: PrivacySettingsProps): React.ReactElement {
  const [localPreferences, setLocalPreferences] = React.useState<PreferencesData>({
    emailNotifications: true,
    smsNotifications: false,
    marketingEmails: false,
    appointmentReminders: true,
    prescriptionAlerts: true,
    messageAlerts: true,
    profileVisibility: 'PROVIDERS_ONLY',
    shareDataForResearch: false,
    ...preferences,
  });
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Track original preferences for change detection
  const originalPreferencesRef = React.useRef(localPreferences);

  React.useEffect(() => {
    if (preferences) {
      const merged = { ...localPreferences, ...preferences };
      setLocalPreferences(merged);
      originalPreferencesRef.current = merged;
    }
  }, [preferences]);

  // Check for changes
  React.useEffect(() => {
    const hasAnyChanges = (
      localPreferences.profileVisibility !== originalPreferencesRef.current.profileVisibility ||
      localPreferences.shareDataForResearch !== originalPreferencesRef.current.shareDataForResearch
    );
    setHasChanges(hasAnyChanges);
  }, [localPreferences]);

  const handleProfileVisibilityChange = (value: 'PRIVATE' | 'PROVIDERS_ONLY'): void => {
    setLocalPreferences((prev) => ({ ...prev, profileVisibility: value }));
  };

  const handleResearchToggle = (): void => {
    setLocalPreferences((prev) => ({ ...prev, shareDataForResearch: !prev.shareDataForResearch }));
  };

  const handleSubmit = async (): Promise<void> => {
    setSubmitError(null);
    setSubmitSuccess(false);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/patient/profile/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(localPreferences),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update privacy settings');
      }

      const result = await res.json();
      
      // Update parent and reset original ref
      onUpdate(result.preferences);
      originalPreferencesRef.current = result.preferences;
      setHasChanges(false);
      setSubmitSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Visibility Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-ocean-500" />
            Profile Visibility
          </CardTitle>
          <CardDescription>
            Control who can see your profile information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Providers Only Option */}
          <div
            className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
              localPreferences.profileVisibility === 'PROVIDERS_ONLY'
                ? 'border-ocean-500 bg-ocean-50'
                : 'border-gray-200 hover:border-ocean-200'
            }`}
            onClick={() => handleProfileVisibilityChange('PROVIDERS_ONLY')}
            role="radio"
            aria-checked={localPreferences.profileVisibility === 'PROVIDERS_ONLY'}
          >
            <div className={`p-2 rounded-full ${
              localPreferences.profileVisibility === 'PROVIDERS_ONLY'
                ? 'bg-ocean-100 text-ocean-600'
                : 'bg-gray-100 text-gray-500'
            }`}>
              <UserCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900">Healthcare Providers Only</h4>
                {localPreferences.profileVisibility === 'PROVIDERS_ONLY' && (
                  <CheckCircle className="h-4 w-4 text-ocean-500" />
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Only your assigned physicians and medical staff can access your profile information. 
                This is the recommended setting for HIPAA compliance.
              </p>
            </div>
          </div>

          {/* Private Option */}
          <div
            className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
              localPreferences.profileVisibility === 'PRIVATE'
                ? 'border-ocean-500 bg-ocean-50'
                : 'border-gray-200 hover:border-ocean-200'
            }`}
            onClick={() => handleProfileVisibilityChange('PRIVATE')}
            role="radio"
            aria-checked={localPreferences.profileVisibility === 'PRIVATE'}
          >
            <div className={`p-2 rounded-full ${
              localPreferences.profileVisibility === 'PRIVATE'
                ? 'bg-ocean-100 text-ocean-600'
                : 'bg-gray-100 text-gray-500'
            }`}>
              <Lock className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900">Private</h4>
                {localPreferences.profileVisibility === 'PRIVATE' && (
                  <CheckCircle className="h-4 w-4 text-ocean-500" />
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Maximum privacy. Information is only accessible when absolutely necessary 
                for your treatment and with your explicit consent.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-ocean-500" />
            Data Usage & Research
          </CardTitle>
          <CardDescription>
            Control how your data is used to improve healthcare
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Research Participation Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${localPreferences.shareDataForResearch ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Share Data for Research</h4>
                <p className="text-sm text-muted-foreground">
                  Anonymized data may be used for medical research to improve addiction treatment
                </p>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                  <li>• Your personal information is always removed</li>
                  <li>• Data is aggregated with other patients</li>
                  <li>• You can opt out at any time</li>
                </ul>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              onClick={handleResearchToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:ring-offset-2 ${
                localPreferences.shareDataForResearch ? 'bg-green-500' : 'bg-gray-200'
              }`}
              aria-pressed={localPreferences.shareDataForResearch}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  localPreferences.shareDataForResearch ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Rights Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-ocean-500" />
            Your Privacy Rights
          </CardTitle>
          <CardDescription>
            Understanding your rights under HIPAA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-ocean-500 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="font-medium text-gray-900">Right to Access</h5>
                <p className="text-sm text-muted-foreground">
                  You can request a copy of your medical records at any time
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-ocean-500 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="font-medium text-gray-900">Right to Amend</h5>
                <p className="text-sm text-muted-foreground">
                  Request corrections to your health information if you believe it is inaccurate
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-ocean-500 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="font-medium text-gray-900">Right to Confidentiality</h5>
                <p className="text-sm text-muted-foreground">
                  Your information is protected and only shared with authorized healthcare providers
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-ocean-500 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="font-medium text-gray-900">Right to Accounting of Disclosures</h5>
                <p className="text-sm text-muted-foreground">
                  You can request a record of when and why your information was shared
                </p>
              </div>
            </li>
          </ul>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Need more information?</strong>{' '}
              Read our{' '}
              <a href="/privacy" className="underline hover:text-blue-900">
                Privacy Policy
              </a>{' '}
              or{' '}
              <a href="/hipaa" className="underline hover:text-blue-900">
                HIPAA Notice
              </a>{' '}
              for complete details about how we protect your information.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Success/Error Messages */}
      <AnimatePresence>
        {submitSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Your privacy settings have been saved.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <LoadingButton
          onClick={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting || !hasChanges}
        >
          {hasChanges ? 'Save Changes' : 'No Changes'}
        </LoadingButton>
      </div>
    </div>
  );
}

export default PrivacySettings;
