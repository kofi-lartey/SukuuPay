import { useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import PinInput from './PinInput';

/**
 * PIN Verification Modal
 *
 * A modal that prompts the parent to enter their PIN (derived from child's DOB).
 * Used for sensitive operations like initiating payments, viewing receipts, etc.
 *
 * The PIN is 8 digits in DDMMYYYY format (e.g., 09062020 for 9th June 2020).
 */
const PinVerificationModal = ({
  isOpen,
  onClose,
  onVerify,
  token,
  title = 'Enter your PIN',
  description = 'Enter the 8-digit PIN derived from your child\'s date of birth (DDMMYYYY).',
  submitLabel = 'Verify',
  loading = false,
  error = null,
}) => {
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setAttempts(0);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handlePinChange = useCallback((value) => {
    setPin(value);
  }, []);

  const handlePinComplete = useCallback(
    async (value) => {
      if (value.length !== 8 || isSubmitting) return;

      setIsSubmitting(true);
      try {
        await onVerify(value);
      } catch (err) {
        setAttempts((prev) => prev + 1);
      } finally {
        setIsSubmitting(false);
      }
    },
    [onVerify, isSubmitting]
  );

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-modal-title"
      aria-describedby="pin-modal-description"
    >
      {/* Backdrop click to close */}
      <div
        className="absolute inset-0"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="relative px-6 py-4 border-b border-slate-100">
          <h2
            id="pin-modal-title"
            className="text-lg font-extrabold text-slate-900"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close PIN verification"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p
            id="pin-modal-description"
            className="text-sm text-slate-600 mb-5"
          >
            {description}
          </p>

          {/* PIN Input */}
          <PinInput
            length={8}
            placeholder="DDMMYYYY"
            onChange={handlePinChange}
            onComplete={handlePinComplete}
            autoFocus={true}
            disabled={isSubmitting || loading}
            error={!!error}
            className="mb-4"
            aria-describedby="pin-modal-description"
          />

          {/* Error message */}
          {error && (
            <div
              className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm"
              role="alert"
              aria-live="polite"
            >
              <div className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 flex-shrink-0"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{error}</span>
              </div>
              {attempts >= 3 && (
                <p className="mt-2 text-xs text-red-600">
                  Too many failed attempts. Please wait before trying again.
                </p>
              )}
            </div>
          )}

          {/* Hint */}
          <p className="text-xs text-slate-500 text-center">
            Example: 09062020 for 9th June 2020
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={handlePinComplete}
            disabled={pin.length !== 8 || isSubmitting || loading}
            className={`
              w-full py-3 rounded-xl font-bold text-sm transition-colors
              ${pin.length === 8 && !isSubmitting && !loading
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }
            `}
          >
            {isSubmitting || loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Verifying...
              </span>
            ) : (
              submitLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PinVerificationModal;