'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Bell, Mail, MessageSquare, Pill, Calendar } from 'lucide-react';
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

interface NotificationPreferencesProps {
  preferences: PreferencesData | null;
  onUpdate: (preferences: PreferencesData) => void;
}

interface NotificationOption {
  key: keyof PreferencesData;
  label: string;
  description: string;
  icon: React.ReactNode;
  requires?: keyof PreferencesData;
}

// ============================================================================
// Main Component
// ============================================================================

export function NotificationPreferences({ 
  preferences, 
  onUpdate 
}: NotificationPreferencesProps): React.ReactElement {
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
      localPreferences.emailNotifications !== originalPreferencesRef.current.emailNotifications ||
      localPreferences.smsNotifications !== originalPreferencesRef.current.smsNotifications ||
      localPreferences.marketingEmails !== originalPreferencesRef.current.marketingEmails ||
      localPreferences.appointmentReminders !== originalPreferencesRef.current.appointmentReminders ||
      localPreferences.prescriptionAlerts !== originalPreferencesRef.current.prescriptionAlerts ||
      localPreferences.messageAlerts !== originalPreferencesRef.current.messageAlerts
    );
    setHasChanges(hasAnyChanges);
  }, [localPreferences]);

  const notificationOptions: NotificationOption[] = [
    {
      key: 'emailNotifications',
      label: 'Email Notifications',
      description: 'Receive notifications via email',
      icon: <Mail className="h-5 w-5" />,
    },
    {
      key: 'smsNotifications',
      label: 'SMS Notifications',
      description: 'Receive notifications via text message',
      icon: <MessageSquare className="h-5 w-5" />,
    },
    {
      key: 'appointmentReminders',
      label: 'Appointment Reminders',
      description: 'Get reminded about upcoming appointments and check-ins',
      icon: <Calendar className="h-5 w-5" />,
      requires: 'emailNotifications',
    },
    {
      key: 'prescriptionAlerts',
      label: 'Prescription Alerts',
      description: 'Notifications about prescription status, refills, and renewals',
      icon: <Pill className="h-5 w-5" />,
      requires: 'emailNotifications',
    },
    {
      key: 'messageAlerts',
      label: 'Message Alerts',
      description: 'Get notified when your doctor sends a message',
      icon: <MessageSquare className="h-5 w-5" />,
      requires: 'emailNotifications',
    },
    {
      key: 'marketingEmails',
      label: 'Marketing Emails',
      description: 'Receive updates about new services and health tips (optional)',
      icon: <Mail className="h-5 w-5" />,
      requires: 'emailNotifications',
    },
  ];

  const handleToggle = (key: keyof PreferencesData): void => {
    setLocalPreferences((prev) => {
      const newValue = !prev[key];
      const updated = { ...prev, [key]: newValue };

      // If disabling email notifications, disable dependent options
      if (key === 'emailNotifications' && !newValue) {
        updated.appointmentReminders = false;
        updated.prescriptionAlerts = false;
        updated.messageAlerts = false;
        updated.marketingEmails = false;
      }

      return updated;
    });
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
        throw new Error(errorData.error || 'Failed to update preferences');
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

  const isOptionDisabled = (option: NotificationOption): boolean => {
    if (option.requires) {
      return !localPreferences[option.requires];
    }
    return false;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-ocean-500" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose how and when you want to be notified
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {notificationOptions.map((option) => {
            const isDisabled = isOptionDisabled(option);
            const isEnabled = localPreferences[option.key];

            return (
              <div
                key={option.key}
                className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                  isDisabled 
                    ? 'bg-gray-50 border-gray-100 opacity-60' 
                    : 'bg-white border-gray-200 hover:border-ocean-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${isEnabled && !isDisabled ? 'bg-ocean-100 text-ocean-600' : 'bg-gray-100 text-gray-500'}`}>
                    {option.icon}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{option.label}</h4>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                    {isDisabled && option.requires && (
                      <p className="text-xs text-amber-600 mt-1">
                        Enable {notificationOptions.find(o => o.key === option.requires)?.label} first
                      </p>
                    )}
                  </div>
                </div>

                {/* Custom Toggle Switch */}
                <button
                  type="button"
                  onClick={() => !isDisabled && handleToggle(option.key)}
                  disabled={isDisabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:ring-offset-2 ${
                    isEnabled ? 'bg-ocean-500' : 'bg-gray-200'
                  } ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  aria-pressed={!!isEnabled}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Notification Summary */}
      <Card className="bg-blue-50 border-blue-100">
        <CardContent className="p-4">
          <h4 className="font-medium text-blue-900 mb-2">Active Notifications</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            {localPreferences.emailNotifications && (
              <li>• Email notifications enabled</li>
            )}
            {localPreferences.smsNotifications && (
              <li>• SMS notifications enabled</li>
            )}
            {!localPreferences.emailNotifications && !localPreferences.smsNotifications && (
              <li>• No notification methods enabled</li>
            )}
            {localPreferences.appointmentReminders && localPreferences.emailNotifications && (
              <li>• Appointment reminders via email</li>
            )}
            {localPreferences.prescriptionAlerts && localPreferences.emailNotifications && (
              <li>• Prescription alerts via email</li>
            )}
            {localPreferences.messageAlerts && localPreferences.emailNotifications && (
              <li>• Message alerts via email</li>
            )}
          </ul>
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
                Your notification preferences have been saved.
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

export default NotificationPreferences;
