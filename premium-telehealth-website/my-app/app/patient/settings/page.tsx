'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Shield, LogOut, Trash2, Mail, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

// ============================================================================
// Types
// ============================================================================

interface NotificationSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
  appointmentReminders: boolean;
  prescriptionAlerts: boolean;
  messageAlerts: boolean;
}

interface ToggleRowProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

// ============================================================================
// Toggle Row Component
// ============================================================================

function ToggleRow({ label, description, icon, enabled, disabled = false, onToggle }: ToggleRowProps): React.ReactElement {
  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
        disabled
          ? 'bg-gray-50 border-gray-100 opacity-60'
          : 'bg-white border-gray-200 hover:border-ocean-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-lg ${
            enabled && !disabled ? 'bg-ocean-100 text-ocean-600' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {icon}
        </div>
        <div>
          <h4 className="font-medium text-gray-900">{label}</h4>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => !disabled && onToggle()}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:ring-offset-2 ${
          enabled ? 'bg-ocean-500' : 'bg-gray-200'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        aria-pressed={enabled}
        aria-label={`Toggle ${label}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

// ============================================================================
// Main Settings Page
// ============================================================================

export default function PatientSettingsPage(): React.ReactElement {
  const router = useRouter();

  const [settings, setSettings] = React.useState<NotificationSettings>({
    emailNotifications: true,
    smsNotifications: false,
    marketingEmails: false,
    appointmentReminders: true,
    prescriptionAlerts: true,
    messageAlerts: true,
  });

  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  // Load settings on mount
  React.useEffect(() => {
    async function loadSettings(): Promise<void> {
      try {
        const res = await fetch('/api/patient/profile/preferences', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.preferences) {
            setSettings({
              emailNotifications: data.preferences.emailNotifications ?? true,
              smsNotifications: data.preferences.smsNotifications ?? false,
              marketingEmails: data.preferences.marketingEmails ?? false,
              appointmentReminders: data.preferences.appointmentReminders ?? true,
              prescriptionAlerts: data.preferences.prescriptionAlerts ?? true,
              messageAlerts: data.preferences.messageAlerts ?? true,
            });
          }
        }
      } catch {
        // Silently proceed with defaults if API unavailable
      }
    }
    void loadSettings();
  }, []);

  const toggle = (key: keyof NotificationSettings): void => {
    setSettings((prev) => {
      const newValue = !prev[key];
      const updated = { ...prev, [key]: newValue };

      // Cascade: disabling email notifications turns off dependent options
      if (key === 'emailNotifications' && !newValue) {
        updated.appointmentReminders = false;
        updated.prescriptionAlerts = false;
        updated.messageAlerts = false;
        updated.marketingEmails = false;
      }

      return updated;
    });
  };

  const handleSaveNotifications = async (): Promise<void> => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/patient/profile/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error((errorData as { error?: string }).error ?? 'Failed to save settings');
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      router.push('/login');
    }
  };

  const isEmailDependent = (key: keyof NotificationSettings): boolean => {
    const emailDependentKeys: Array<keyof NotificationSettings> = [
      'appointmentReminders',
      'prescriptionAlerts',
      'messageAlerts',
      'marketingEmails',
    ];
    return emailDependentKeys.includes(key) && !settings.emailNotifications;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage your notification preferences and account settings.
        </p>
      </div>

      <div className="space-y-8 max-w-2xl">
        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-ocean-500" />
              Notification Preferences
            </CardTitle>
            <CardDescription>
              Choose how you want to receive updates from Rimal Health
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              label="Email Notifications"
              description="Receive updates and alerts via email"
              icon={<Mail className="h-5 w-5" />}
              enabled={settings.emailNotifications}
              onToggle={() => toggle('emailNotifications')}
            />
            <ToggleRow
              label="SMS Notifications"
              description="Receive text message alerts on your phone"
              icon={<MessageSquare className="h-5 w-5" />}
              enabled={settings.smsNotifications}
              onToggle={() => toggle('smsNotifications')}
            />
            <ToggleRow
              label="Appointment Reminders"
              description="Get reminded about upcoming check-ins and appointments"
              icon={<Bell className="h-5 w-5" />}
              enabled={settings.appointmentReminders}
              disabled={isEmailDependent('appointmentReminders')}
              onToggle={() => toggle('appointmentReminders')}
            />
            <ToggleRow
              label="Prescription Alerts"
              description="Notifications about prescription status and refill availability"
              icon={<Bell className="h-5 w-5" />}
              enabled={settings.prescriptionAlerts}
              disabled={isEmailDependent('prescriptionAlerts')}
              onToggle={() => toggle('prescriptionAlerts')}
            />
            <ToggleRow
              label="Message Alerts"
              description="Get notified when your doctor sends you a message"
              icon={<Bell className="h-5 w-5" />}
              enabled={settings.messageAlerts}
              disabled={isEmailDependent('messageAlerts')}
              onToggle={() => toggle('messageAlerts')}
            />
            <ToggleRow
              label="Marketing Emails"
              description="Receive health tips and updates about new services (optional)"
              icon={<Mail className="h-5 w-5" />}
              enabled={settings.marketingEmails}
              disabled={isEmailDependent('marketingEmails')}
              onToggle={() => toggle('marketingEmails')}
            />

            {/* Feedback messages */}
            {saveSuccess && (
              <Alert className="bg-green-50 border-green-200">
                <AlertDescription className="text-green-800">
                  Notification preferences saved.
                </AlertDescription>
              </Alert>
            )}
            {saveError && (
              <Alert variant="destructive">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => void handleSaveNotifications()}
                disabled={isSaving}
                className="bg-ocean-500 hover:bg-ocean-600 text-white"
              >
                {isSaving ? 'Saving...' : 'Save Preferences'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-ocean-500" />
              Privacy
            </CardTitle>
            <CardDescription>
              Control your privacy and data sharing preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Your profile and health data are only accessible to your assigned healthcare providers
              under HIPAA protections. For detailed privacy and data research settings, visit your{' '}
              <a href="/patient/profile/settings" className="text-ocean-600 hover:underline font-medium">
                Profile Settings
              </a>
              .
            </p>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm text-blue-800">
                <strong>HIPAA Protected:</strong> All your personal health information is encrypted
                and protected under HIPAA regulations. Read our{' '}
                <a href="/hipaa" className="underline hover:text-blue-900">
                  HIPAA Notice
                </a>{' '}
                for full details.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-ocean-500" />
              Account
            </CardTitle>
            <CardDescription>
              Sign out or manage your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Sign out */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
              <div>
                <h4 className="font-medium text-gray-900">Sign Out</h4>
                <p className="text-sm text-gray-500">Sign out of your Rimal Health account on this device</p>
              </div>
              <Button
                variant="outline"
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
                className="shrink-0"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {isLoggingOut ? 'Signing out...' : 'Sign Out'}
              </Button>
            </div>

            {/* Delete account (placeholder) */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-red-100 bg-red-50">
              <div>
                <h4 className="font-medium text-red-900">Delete Account</h4>
                <p className="text-sm text-red-700">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
              </div>
              <Button
                variant="outline"
                className="shrink-0 border-red-300 text-red-700 hover:bg-red-100"
                onClick={() => {
                  // Contact support to initiate account deletion per HIPAA data retention policy
                  window.location.href = '/contact?subject=Account+Deletion+Request';
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
