import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

export default function Toast({ id, message, type = 'success', onClose }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation immediately
    const enterTimer = requestAnimationFrame(() => {
      setIsVisible(true);
    });

    // Auto-dismiss after 2.5 seconds (2500ms), followed by 300ms exit fade
    const dismissTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, 2500);

    return () => {
      cancelAnimationFrame(enterTimer);
      clearTimeout(dismissTimer);
    };
  }, [onClose]);

  const handleManualClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const isSuccess = type === 'success';

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md transition-all duration-300 transform ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 -translate-y-2 scale-95'
      } ${
        isSuccess
          ? 'bg-[#061e14]/90 border border-emerald-500/40 text-emerald-100 shadow-emerald-950/40'
          : 'bg-[#23090e]/90 border border-red-500/40 text-red-100 shadow-red-950/40'
      }`}
    >
      <div className="flex items-center gap-3">
        {isSuccess ? (
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-red-400 shrink-0" />
        )}
        <span className="text-sm font-medium leading-snug">{message}</span>
      </div>
      <button
        type="button"
        onClick={handleManualClose}
        className="text-white/40 hover:text-white/80 p-0.5 rounded-lg transition-colors shrink-0 cursor-pointer"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
