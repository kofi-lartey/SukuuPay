import { useState, useEffect, useCallback } from 'react';
import { getVerificationStatus } from '../services/verification';

export function useVerificationStatus(schoolId) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getVerificationStatus(schoolId);
      setStatus(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    load();
  }, [load]);

  // Listen for real-time verification updates via socket
  useEffect(() => {
    const handleUpdate = (event) => {
      const data = event.detail;
      if (data?.schoolId && String(data.schoolId) === String(schoolId)) {
        setStatus((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            verificationStatus: data.verificationStatus || prev.verificationStatus,
            verificationTier: data.verificationTier ?? prev.verificationTier,
            rejectionReason: data.rejectionReason ?? prev.rejectionReason,
            verifiedAt: data.verifiedAt || prev.verifiedAt,
          };
        });
      }
    };

    window.addEventListener('verification:updated', handleUpdate);
    return () => window.removeEventListener('verification:updated', handleUpdate);
  }, [schoolId]);

  return { status, loading, error, reload: load };
}