'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Simple Custom Sheet Component
// ============================================================================

interface SheetProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface SheetTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

interface SheetContentProps {
  children: React.ReactNode;
  side?: 'left' | 'right' | 'top' | 'bottom';
  className?: string;
}

// Context for sheet state
const SheetContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

function useSheet() {
  const context = React.useContext(SheetContext);
  if (!context) {
    throw new Error('Sheet components must be used within a Sheet');
  }
  return context;
}

// Sheet Root
function Sheet({ children, open: controlledOpen, onOpenChange }: SheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (value: boolean) => {
    setUncontrolledOpen(value);
    onOpenChange?.(value);
  };

  return (
    <SheetContext.Provider value={{ open, setOpen }}>
      {children}
    </SheetContext.Provider>
  );
}

// Sheet Trigger
function SheetTrigger({ children, asChild }: SheetTriggerProps) {
  const { setOpen } = useSheet();
  
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: () => setOpen(true),
    } as React.HTMLAttributes<HTMLElement>);
  }

  return (
    <button onClick={() => setOpen(true)}>
      {children}
    </button>
  );
}

// Sheet Close
function SheetClose({ children, asChild }: SheetTriggerProps) {
  const { setOpen } = useSheet();
  
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: () => setOpen(false),
    } as React.HTMLAttributes<HTMLElement>);
  }

  return (
    <button onClick={() => setOpen(false)}>
      {children}
    </button>
  );
}

// Sheet Content
function SheetContent({ children, side = 'right', className }: SheetContentProps) {
  const { open, setOpen } = useSheet();

  // Close on escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, setOpen]);

  if (!open) return null;

  const sideStyles = {
    left: 'inset-y-0 left-0 h-full w-3/4 max-w-sm border-r',
    right: 'inset-y-0 right-0 h-full w-3/4 max-w-sm border-l',
    top: 'inset-x-0 top-0 w-full h-auto max-h-[50vh] border-b',
    bottom: 'inset-x-0 bottom-0 w-full h-auto max-h-[50vh] border-t',
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 animate-in fade-in duration-200"
        onClick={() => setOpen(false)}
      />
      
      {/* Content */}
      <div
        className={cn(
          'absolute bg-white shadow-lg animate-in duration-300',
          side === 'left' && 'slide-in-from-left',
          side === 'right' && 'slide-in-from-right',
          side === 'top' && 'slide-in-from-top',
          side === 'bottom' && 'slide-in-from-bottom',
          sideStyles[side],
          className
        )}
      >
        {/* Close button */}
        <button
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 p-2 rounded-md hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        
        <div className="h-full overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

// Sheet Header
function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col space-y-2 p-6', className)}
      {...props}
    />
  );
}

// Sheet Footer
function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-6', className)}
      {...props}
    />
  );
}

// Sheet Title
function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('text-lg font-semibold text-gray-900', className)}
      {...props}
    />
  );
}

// Sheet Description
function SheetDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-sm text-gray-500', className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
