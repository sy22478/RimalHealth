/**
 * MessageNotifications Component
 * 
 * Real-time notification system for physician messages.
 * Shows toast notifications for new messages with optional sound and browser notifications.
 * 
 * @module components/physician/MessageNotifications
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { X, MessageSquare, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMessagePolling, type LastMessageInfo } from '@/hooks/useMessagePolling';

// ============================================================================
// Types
// ============================================================================

interface MessageNotificationsProps {
  /** Callback when user clicks on a message notification */
  onMessageClick?: (threadId: string) => void;
  /** Polling interval in milliseconds (default: 30000) */
  interval?: number;
}

interface Toast {
  id: string;
  title: string;
  description: string;
  threadId: string;
  createdAt: number;
}

interface UserPreferences {
  soundEnabled: boolean;
  browserNotificationsEnabled: boolean;
}

// ============================================================================
// Sound Utility
// ============================================================================

/**
 * Create and play a subtle notification sound
 */
function playNotificationSound(): void {
  try {
    // Create audio context for a subtle beep
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Subtle notification sound
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    // Short, quiet beep
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch {
    // Silently fail if audio is not supported
  }
}

// ============================================================================
// Toast Component
// ============================================================================

interface MessageToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
  onView: (threadId: string) => void;
}

function MessageToast({ toast, onDismiss, onView }: MessageToastProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'w-full max-w-sm bg-white rounded-lg shadow-lg border border-ocean-200',
        'overflow-hidden pointer-events-auto'
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex-shrink-0 w-10 h-10 bg-ocean-100 rounded-full flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-ocean-600" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 truncate">
            {toast.title}
          </h4>
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
            {toast.description}
          </p>
          
          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              className="h-8 text-xs bg-ocean-600 hover:bg-ocean-700"
              onClick={() => onView(toast.threadId)}
            >
              View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-gray-500 hover:text-gray-700"
              onClick={() => onDismiss(toast.id)}
            >
              Dismiss
            </Button>
          </div>
        </div>
        
        <button
          onClick={() => onDismiss(toast.id)}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Preferences Manager
// ============================================================================

const PREFERENCES_KEY = 'rimal-message-preferences';

function getStoredPreferences(): UserPreferences {
  if (typeof window === 'undefined') {
    return { soundEnabled: true, browserNotificationsEnabled: false };
  }
  
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (stored) {
      return JSON.parse(stored) as UserPreferences;
    }
  } catch {
    // Ignore parse errors
  }
  
  return { soundEnabled: true, browserNotificationsEnabled: false };
}

function savePreferences(preferences: UserPreferences): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Message Notifications Component
 * 
 * Displays real-time toast notifications for new physician messages.
 * Features:
 * - Toast notifications with sender name and message preview
 * - Auto-dismiss after 5 seconds
 * - Action buttons: "View" and "Dismiss"
 * - Browser notification API integration (optional)
 * - Sound notification (optional, user preference)
 * - Unread badge updates
 * 
 * @example
 * ```tsx
 * // In physician layout
 * <MessageNotifications 
 *   onMessageClick={(threadId) => router.push(`/physician/messages?thread=${threadId}`)}
 * />
 * ```
 */
export function MessageNotifications({
  onMessageClick,
  interval = 30000,
}: MessageNotificationsProps): React.ReactElement | null {
  const router = useRouter();
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [preferences, setPreferences] = React.useState<UserPreferences>(getStoredPreferences);
  const [prevCount, setPrevCount] = React.useState(0);
  const [lastNotifiedId, setLastNotifiedId] = React.useState<string | null>(null);

  // Use the polling hook
  const { unreadCount, lastMessage } = useMessagePolling({ interval });

  // Load preferences on mount
  React.useEffect(() => {
    setPreferences(getStoredPreferences());
  }, []);

  // Request browser notification permission
  React.useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      preferences.browserNotificationsEnabled &&
      Notification.permission === 'default'
    ) {
      void Notification.requestPermission();
    }
  }, [preferences.browserNotificationsEnabled]);

  /**
   * Show a toast notification
   */
  const showToast = React.useCallback((message: LastMessageInfo) => {
    const newToast: Toast = {
      id: `${message.id}-${Date.now()}`,
      title: `New message from ${message.senderName}`,
      description: message.subject,
      threadId: message.threadId,
      createdAt: Date.now(),
    };

    setToasts((prev) => [...prev, newToast]);
  }, []);

  /**
   * Dismiss a toast by ID
   */
  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /**
   * Handle view button click
   */
  const handleView = React.useCallback((threadId: string) => {
    // Dismiss all toasts for this thread
    setToasts((prev) => prev.filter((t) => t.threadId !== threadId));
    
    if (onMessageClick) {
      onMessageClick(threadId);
    } else {
      // Default behavior: navigate to messages page
      router.push(`/physician/messages?thread=${threadId}`);
    }
  }, [onMessageClick, router]);

  /**
   * Toggle sound preference
   */
  const toggleSound = React.useCallback(() => {
    setPreferences((prev) => {
      const updated = { ...prev, soundEnabled: !prev.soundEnabled };
      savePreferences(updated);
      return updated;
    });
  }, []);

  /**
   * Toggle browser notifications preference
   */
  const toggleBrowserNotifications = React.useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    if (!preferences.browserNotificationsEnabled) {
      // Requesting permission to enable
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPreferences((prev) => {
          const updated = { ...prev, browserNotificationsEnabled: true };
          savePreferences(updated);
          return updated;
        });
      }
    } else {
      // Disabling
      setPreferences((prev) => {
        const updated = { ...prev, browserNotificationsEnabled: false };
        savePreferences(updated);
        return updated;
      });
    }
  }, [preferences.browserNotificationsEnabled]);

  // Auto-dismiss toasts after 5 seconds
  React.useEffect(() => {
    if (toasts.length === 0) return;

    const timers = toasts.map((toast) => {
      const elapsed = Date.now() - toast.createdAt;
      const remaining = Math.max(0, 5000 - elapsed);
      
      return setTimeout(() => {
        dismissToast(toast.id);
      }, remaining);
    });

    return () => timers.forEach(clearTimeout);
  }, [toasts, dismissToast]);

  // Handle new messages
  React.useEffect(() => {
    if (unreadCount > prevCount && lastMessage) {
      // Avoid duplicate notifications for the same message
      if (lastNotifiedId === lastMessage.id) {
        setPrevCount(unreadCount);
        return;
      }

      // Show toast notification
      showToast(lastMessage);
      setLastNotifiedId(lastMessage.id);

      // Play sound if enabled
      if (preferences.soundEnabled) {
        playNotificationSound();
      }

      // Browser notification
      if (
        preferences.browserNotificationsEnabled &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          const notification = new Notification('New Message', {
            body: `${lastMessage.senderName}: ${lastMessage.subject}`,
            icon: '/icon.png',
            tag: lastMessage.threadId,
          });

          notification.onclick = () => {
            window.focus();
            handleView(lastMessage.threadId);
            notification.close();
          };
        } catch {
          // Silently fail if notification fails
        }
      }
    }
    
    setPrevCount(unreadCount);
  }, [
    unreadCount,
    prevCount,
    lastMessage,
    lastNotifiedId,
    preferences.soundEnabled,
    preferences.browserNotificationsEnabled,
    showToast,
    handleView,
  ]);

  // Don't render anything if no toasts and no need for controls
  // Still render the container for the settings controls
  return (
    <>
      {/* Toast Container */}
      <div
        className={cn(
          'fixed bottom-4 right-4 z-50 flex flex-col gap-2',
          'max-w-sm w-full pointer-events-none'
        )}
        aria-live="polite"
        aria-atomic="true"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <MessageToast
              key={toast.id}
              toast={toast}
              onDismiss={dismissToast}
              onView={handleView}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Settings Controls - Only visible when there are notifications or on hover */}
      <div className="fixed bottom-4 left-4 z-50 hidden lg:flex items-center gap-2">
        <AnimatePresence>
          {toasts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex items-center gap-1 bg-white rounded-lg shadow-md border border-gray-200 p-1"
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleSound}
                title={preferences.soundEnabled ? 'Mute notifications' : 'Enable notification sounds'}
              >
                {preferences.soundEnabled ? (
                  <Volume2 className="h-4 w-4 text-ocean-600" />
                ) : (
                  <VolumeX className="h-4 w-4 text-gray-400" />
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

export type { MessageNotificationsProps };
