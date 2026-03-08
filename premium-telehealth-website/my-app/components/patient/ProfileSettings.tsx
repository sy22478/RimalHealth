'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Lock, 
  Bell, 
  Shield, 
  Loader2,
  AlertCircle 
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PersonalInfoForm } from './PersonalInfoForm';
import { ChangePasswordForm } from './ChangePasswordForm';
import { NotificationPreferences } from './NotificationPreferences';
import { PrivacySettings } from './PrivacySettings';

// ============================================================================
// Types
// ============================================================================

interface ProfileData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  dateOfBirth: string;
  phone: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  medicalHistory: string | null;
  currentMedications: string | null;
  allergies: string | null;
  primaryConcern: string | null;
  treatmentGoal: string | null;
}

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

// ============================================================================
// Loading State Component
// ============================================================================

function LoadingState(): React.ReactElement {
  return (
    <Card>
      <CardContent className="p-12">
        <div className="flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-ocean-500 mb-4" />
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Error State Component
// ============================================================================

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

function ErrorState({ error, onRetry }: ErrorStateProps): React.ReactElement {
  return (
    <Card>
      <CardContent className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4 text-center">
          <button
            onClick={onRetry}
            className="text-ocean-600 hover:text-ocean-700 font-medium"
          >
            Try again
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Profile Settings Component
// ============================================================================

export function ProfileSettings(): React.ReactElement {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState('personal');
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [profile, setProfile] = React.useState<ProfileData | null>(null);
  const [preferences, setPreferences] = React.useState<PreferencesData | null>(null);

  // Fetch profile and preferences data
  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch profile using cookie-based auth
      const profileRes = await fetch('/api/patient/profile', {
        credentials: 'include',
      });

      if (profileRes.status === 401) {
        router.push('/login');
        return;
      }

      if (!profileRes.ok) {
        throw new Error('Failed to load profile');
      }

      const profileData = await profileRes.json();
      setProfile(profileData.profile);

      // Fetch preferences
      const preferencesRes = await fetch('/api/patient/profile/preferences', {
        credentials: 'include',
      });

      if (preferencesRes.ok) {
        const preferencesData = await preferencesRes.json();
        setPreferences(preferencesData.preferences);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Initial data fetch
  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={fetchData} />;
  }

  if (!profile) {
    return <ErrorState error="Profile not found" onRetry={fetchData} />;
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
        <TabsTrigger value="personal" className="flex items-center gap-2">
          <User className="h-4 w-4 hidden sm:inline" />
          <span>Personal Info</span>
        </TabsTrigger>
        <TabsTrigger value="password" className="flex items-center gap-2">
          <Lock className="h-4 w-4 hidden sm:inline" />
          <span>Password</span>
        </TabsTrigger>
        <TabsTrigger value="notifications" className="flex items-center gap-2">
          <Bell className="h-4 w-4 hidden sm:inline" />
          <span>Notifications</span>
        </TabsTrigger>
        <TabsTrigger value="privacy" className="flex items-center gap-2">
          <Shield className="h-4 w-4 hidden sm:inline" />
          <span>Privacy</span>
        </TabsTrigger>
      </TabsList>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <TabsContent value="personal" className="mt-0">
            <PersonalInfoForm 
              profile={profile} 
              onUpdate={(updatedProfile) => setProfile({ ...profile, ...updatedProfile })}
            />
          </TabsContent>

          <TabsContent value="password" className="mt-0">
            <ChangePasswordForm />
          </TabsContent>

          <TabsContent value="notifications" className="mt-0">
            <NotificationPreferences 
              preferences={preferences}
              onUpdate={setPreferences}
            />
          </TabsContent>

          <TabsContent value="privacy" className="mt-0">
            <PrivacySettings 
              preferences={preferences}
              onUpdate={setPreferences}
            />
          </TabsContent>
        </motion.div>
      </AnimatePresence>
    </Tabs>
  );
}

export default ProfileSettings;
