'use client';

// apps/web/src/components/demo/DemoToast.tsx
// Lightweight toast system for the demo experience.

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const STYLES: Record<ToastType, { icon: string; ring: string; bar: string }> = {
  success: { icon: '✅', ring: 'border-[var(--color-success)]/40', bar: 'bg-[var(--color-success)]' },
  error: { icon: '❌', ring: 'border-[var(--color-error)]/40', bar: 'bg-[var(--color-error)]' },
  info: { icon: '💡', ring: 'border-[var(--brand-cyan)]/40', bar: 'bg-[var(--brand-cyan)]' },
};

export function DemoToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
      window.setTimeout(() => remove(id), 4200);
    },
    [remove],
  );

  const value: ToastContextValue = {
    toast,
    success: useCallback((m: string) => toast('success', m), [toast]),
    error: useCallback((m: string) => toast('error', m), [toast]),
    info: useCallback((m: string) => toast('info', m), [toast]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-enter pointer-events-auto bg-[var(--surface)] border ${STYLES[t.type].ring} shadow-xl rounded-xl p-4 flex items-start gap-3 relative overflow-hidden`}
          >
            <span className="text-lg">{STYLES[t.type].icon}</span>
            <p className="text-sm text-[var(--foreground)] flex-1">{t.message}</p>
            <button
              onClick={() => remove(t.id)}
              className="text-[var(--neutral-gray-400)] hover:text-[var(--foreground)] transition-colors"
              aria-label="Dismiss"
            >
              ✕
            </button>
            <span className={`absolute bottom-0 left-0 h-0.5 ${STYLES[t.type].bar} toast-timer`} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useDemoToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe fallback so components render even without a provider.
    return { toast: () => {}, success: () => {}, error: () => {}, info: () => {} };
  }
  return ctx;
}
