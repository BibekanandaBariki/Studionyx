import { useCallback, useState } from 'react';

let idCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++idCounter;
    const toast = { id, message, type };
    setToasts((prev) => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ToastContainer = () => (
    <div className="fixed bottom-6 right-6 z-50 space-y-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl px-4 py-3 shadow-lg text-sm text-coolwhite flex items-center gap-2 ${
            toast.type === 'error' ? 'border-red-400/60' : ''
          }`}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-2 text-xs text-coolwhite/70 hover:text-coolwhite"
          >
            Close
          </button>
        </div>
      ))}
    </div>
  );

  return { showToast, ToastContainer };
}

export default useToast;


