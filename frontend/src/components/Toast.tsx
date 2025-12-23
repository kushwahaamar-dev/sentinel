import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { useEffect, useCallback } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

type ToastData = {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
};

type Props = {
  toasts: ToastData[];
  onRemove: (id: string) => void;
};

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="text-emerald-400" size={18} />,
  error: <XCircle className="text-rose-400" size={18} />,
  warning: <AlertTriangle className="text-amber-400" size={18} />,
  info: <Info className="text-sky-400" size={18} />,
};

const borderColors: Record<ToastType, string> = {
  success: "border-l-emerald-500",
  error: "border-l-rose-500",
  warning: "border-l-amber-500",
  info: "border-l-sky-500",
};

// Auto-dismiss hook
function useAutoDismiss(id: string, duration: number, onRemove: (id: string) => void) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onRemove]);
}

// Individual toast - must be separate to use hooks
function SingleToast({ toast, onRemove }: { toast: ToastData; onRemove: (id: string) => void }) {
  useAutoDismiss(toast.id, toast.duration || 4000, onRemove);
  
  return (
    <>
      <div className="mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 text-sm text-white">{toast.message}</div>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-slate-400 hover:text-white transition"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </>
  );
}

export function ToastContainer({ toasts, onRemove }: Props) {
  return (
    <div className="fixed top-20 right-6 z-[100] flex flex-col gap-2">
      <AnimatePresence mode="sync">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={`glass rounded-xl border-l-4 ${borderColors[toast.type]} p-4 shadow-2xl flex items-start gap-3 min-w-[300px] max-w-[400px]`}
          >
            <SingleToast toast={toast} onRemove={onRemove} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Toast creation helper
let toastId = 0;
export const createToast = (type: ToastType, message: string, duration?: number): ToastData => ({
  id: `toast-${++toastId}`,
  type,
  message,
  duration,
});
