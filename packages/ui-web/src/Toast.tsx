import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import clsx from 'clsx';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (options: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (options: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { ...options, id }]);
      const duration = options.duration ?? 4000;
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} className="text-[#2E7D32]" />,
  error: <AlertCircle size={18} className="text-[#C62828]" />,
  info: <Info size={18} className="text-[#1565C0]" />,
  warning: <AlertCircle size={18} className="text-[#F57C00]" />,
};

const toastStyles: Record<ToastType, string> = {
  success: 'border-l-4 border-[#2E7D32] bg-[#E8F5E9]',
  error: 'border-l-4 border-[#C62828] bg-[#FFEBEE]',
  info: 'border-l-4 border-[#1565C0] bg-[#E3F2FD]',
  warning: 'border-l-4 border-[#F57C00] bg-[#FFF3E0]',
};

function ToastContainer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  return (
    <div
      className="fixed bottom-5 right-5 z-[500] flex flex-col gap-2 w-80"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={clsx(
            'flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg',
            toastStyles[t.type]
          )}
        >
          <span className="mt-0.5 shrink-0">{icons[t.type]}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-[#1A0A03]">{t.title}</p>
            {t.message && <p className="text-xs text-[#5C3D2E] mt-0.5">{t.message}</p>}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="text-[#9E7B6A] hover:text-[#4A1E0B] rounded shrink-0"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
