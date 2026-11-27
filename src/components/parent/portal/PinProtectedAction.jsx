import React, { useState, useCallback } from 'react';
import { usePinVerification } from '../../../layouts/ParentLayout';

/**
 * PIN Protected Action Wrapper
 *
 * A component that wraps a sensitive action with PIN verification.
 * When the trigger is clicked, it opens the PIN verification modal.
 * Only after successful PIN verification does it execute the action.
 *
 * Usage:
 * ```jsx
 * <PinProtectedAction
 *   trigger={<button>Pay Now</button>}
 *   onAction={async () => { await initiatePayment(); }}
 *   title="Verify PIN to Pay"
 *   description="Enter your PIN to authorize this payment."
 * />
 * ```
 */
const PinProtectedAction = ({
  children, // The trigger element (button, link, etc.)
  onAction, // Async function to execute after PIN verification
  title = 'Enter your PIN',
  description = 'Enter your 8-digit PIN to authorize this action.',
  submitLabel = 'Verify & Continue',
  disabled = false,
  loading: externalLoading = false,
}) => {
  const {
    openPinModal,
    closePinModal,
    verifyPin,
    isPinModalOpen,
    pinLoading,
    pinError,
    pinVerified,
    resetPinVerification,
  } = usePinVerification();

  const [pendingAction, setPendingAction] = useState(null);
  const isLoading = pinLoading || externalLoading;

  const handleTriggerClick = useCallback(() => {
    if (disabled || isLoading) return;
    // Reset any previous verification state
    resetPinVerification();
    // Store the action to execute after verification
    setPendingAction(onAction);
    // Open the PIN modal
    openPinModal();
  }, [disabled, isLoading, onAction, openPinModal, resetPinVerification]);

  const handlePinVerify = useCallback(
    async (pin) => {
      try {
        await verifyPin(pin);
        // PIN verified - execute the pending action
        if (pendingAction) {
          await pendingAction();
        }
        setPendingAction(null);
      } catch (err) {
        // Error is handled by the modal (pinError state)
        // Re-throw to prevent modal from closing
        throw err;
      }
    },
    [pendingAction, verifyPin]
  );

  // Wrap the children with the click handler
  const trigger = typeof children === 'function' ? children({ onClick: handleTriggerClick }) : children;

  return (
    <>
      {/* Render the trigger with our click handler */}
      {React.isValidElement(trigger) ? (
        React.cloneElement(trigger, {
          onClick: handleTriggerClick,
          disabled: disabled || isLoading,
        })
      ) : (
        <button
          type="button"
          onClick={handleTriggerClick}
          disabled={disabled || isLoading}
          className="w-full"
        >
          {trigger}
        </button>
      )}

      {/* PIN Verification Modal is rendered in ParentLayout */}
    </>
  );
};

export default PinProtectedAction;