import { useState } from 'react';
import { useParentPay } from '../../layouts/ParentLayout';
import PinProtectedAction from '../../components/parent/portal/PinProtectedAction';
import PinInput from '../../components/parent/portal/PinInput';
import PinVerificationModal from '../../components/parent/portal/PinVerificationModal';
import { verifyPin as verifyPinApi } from '../../services/parent/portal';

/**
 * PIN Verification Demo Page
 *
 * A demonstration page showing various ways to use the PIN verification system.
 * This page can be accessed at /pay/:token/pin-demo
 */
const PinDemo = () => {
  const { token, student } = useParentPay();
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const handlePinVerify = async (pin) => {
    setPinLoading(true);
    setPinError(null);
    try {
      const result = await verifyPinApi(token, pin);
      setPinVerified(true);
      setLastResult(result);
      setShowModal(false);
      return result;
    } catch (err) {
      setPinError(err.response?.data?.message || err.message || 'Verification failed');
      throw err;
    } finally {
      setPinLoading(false);
    }
  };

  const handleProtectedAction = async () => {
    // This would be your sensitive action (e.g., initiate payment)
    await new Promise((resolve) => setTimeout(resolve, 1000));
    alert('Protected action executed successfully!');
    setLastResult({ action: 'protected-action', timestamp: new Date().toISOString() });
  };

  const handleDirectVerify = async (pin) => {
    setPinLoading(true);
    setPinError(null);
    try {
      const result = await verifyPinApi(token, pin);
      setPinVerified(true);
      setLastResult(result);
      return result;
    } catch (err) {
      setPinError(err.response?.data?.message || err.message || 'Verification failed');
      throw err;
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200/80">
        <h1 className="text-xl font-extrabold text-slate-900">PIN Verification Demo</h1>
        <p className="mt-2 text-sm text-slate-500">
          This page demonstrates the PIN verification system for the parent portal.
          The PIN is derived from your child's date of birth (DDMMYYYY format).
        </p>
        {student?.dateOfBirth && (
          <p className="mt-2 text-xs text-slate-400 font-mono">
            Child's DOB: {new Date(student.dateOfBirth).toLocaleDateString('en-GB')} → Expected PIN:{" "}
            <span className="font-bold">
              {String(new Date(student.dateOfBirth).getDate()).padStart(2, '0')}
              {String(new Date(student.dateOfBirth).getMonth() + 1).padStart(2, '0')}
              {new Date(student.dateOfBirth).getFullYear()}
            </span>
          </p>
        )}
      </div>

      {/* Direct PIN Input */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200/80">
        <h2 className="text-lg font-bold text-slate-900">Direct PIN Input</h2>
        <p className="mt-2 text-sm text-slate-500">
          Enter PIN directly using the PinInput component
        </p>
        <PinInput
          length={8}
          placeholder="DDMMYYYY"
          onComplete={handleDirectVerify}
          error={!!pinError}
          disabled={pinLoading}
          className="mt-4 max-w-xs"
        />
        {pinError && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {pinError}
          </p>
        )}
        {pinVerified && (
          <p className="mt-3 text-sm text-emerald-600">
            ✓ PIN verified successfully!
          </p>
        )}
      </div>

      {/* Modal Trigger */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200/80">
        <h2 className="text-lg font-bold text-slate-900">Modal Verification</h2>
        <p className="mt-2 text-sm text-slate-500">
          Open the PIN verification modal manually
        </p>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={pinLoading}
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-extrabold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {pinLoading ? 'Verifying...' : 'Open PIN Modal'}
        </button>

        <PinVerificationModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onVerify={handlePinVerify}
          token={token}
          title="Demo: Verify PIN"
          description="Enter your 8-digit PIN to continue."
          submitLabel="Verify"
          loading={pinLoading}
          error={pinError}
        />
      </div>

      {/* Protected Action Wrapper */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200/80">
        <h2 className="text-lg font-bold text-slate-900">Protected Action</h2>
        <p className="mt-2 text-sm text-slate-500">
          Click the button below - it will require PIN verification before executing
        </p>
        <PinProtectedAction
          onAction={handleProtectedAction}
          title="Authorize Action"
          description="Enter your PIN to authorize this sensitive action."
          submitLabel="Verify & Execute"
        >
          <button
            type="button"
            className="w-full inline-flex h-11 items-center gap-2 rounded-xl bg-[#0A5C36] px-6 text-sm font-extrabold text-white transition-colors hover:bg-emerald-700"
          >
            Execute Protected Action
          </button>
        </PinProtectedAction>
      </div>

      {/* Result Display */}
      {lastResult && (
        <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200/80">
          <h3 className="text-sm font-bold text-slate-900">Last Result</h3>
          <pre className="mt-2 text-xs text-slate-600 overflow-auto max-h-40">
            {JSON.stringify(lastResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default PinDemo;