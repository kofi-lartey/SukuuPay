import { useState, useCallback } from 'react';
import { useParentPay } from '../../../layouts/ParentLayout';
import { verifyPin as verifyPinApi } from '../../../services/parent/portal';

/**
 * Hook for PIN verification in the parent portal.
 *
 * Provides state and functions for:
 * - Opening/closing the PIN verification modal
 * - Verifying the PIN against the backend
 * - Managing verification state (verified, loading, error)
 *
 * The PIN is derived from the child's DOB (DDMMYYYY format).
 */
export const usePinVerification = () => {
  const { token } = useParentPay();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

  const openModal = useCallback((action = null) => {
    setPendingAction(action);
    setError(null);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setPendingAction(null);
    setError(null);
  }, []);

  const verifyPin = useCallback(
    async (pin) => {
      if (!token) {
        throw new Error('No token available');
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await verifyPinApi(token, pin);
        setIsVerified(true);
        return result;
      } catch (err) {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          'Incorrect PIN. Please try again.';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  const resetVerification = useCallback(() => {
    setIsVerified(false);
  }, []);

  return {
    // State
    isModalOpen,
    isVerified,
    isLoading,
    error,
    pendingAction,
    token,

    // Actions
    openModal,
    closeModal,
    verifyPin,
    resetVerification,
  };
};

export default usePinVerification;