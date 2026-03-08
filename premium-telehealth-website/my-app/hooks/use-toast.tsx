"use client";

import * as React from "react";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

interface ToastContextType {
  toasts: Toast[];
  toast: (props: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const toast = React.useCallback((props: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...props, id }]);
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg shadow-lg p-4 min-w-[300px] animate-in slide-in-from-right ${
              t.variant === "destructive"
                ? "bg-destructive text-destructive-foreground"
                : "bg-navy-800 text-white"
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold">{t.title}</h4>
                {t.description && (
                  <p className="text-sm opacity-90 mt-1">{t.description}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="ml-2 text-sm opacity-70 hover:opacity-100"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    // Return a mock toast function if not in provider
    return {
      toast: (props: Omit<Toast, "id">) => {
        console.log("Toast:", props);
      },
      toasts: [],
      dismiss: () => {},
    };
  }
  return context;
}
