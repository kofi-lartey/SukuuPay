import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, FileText, LoaderCircle, AlertCircle } from 'lucide-react';
import { getVerificationStatus, adminVerifySchool } from '../../../services/verification';
import { useToast } from '../../../hooks/useToast';
import Card from '../../dashboard/ui/Card';
import Badge from '../../dashboard/ui/Badge';

const DOCUMENT_LABELS = {
  NASIA_LICENSE: 'NaSIA License / Registration',
  RGD_CERTIFICATE: 'RGD Certificate of Incorporation',
  AUTHORIZATION_LETTER: 'Authorization Letter',
  HEADTEACHER_ID: "Headteacher / Proprietor ID",
};

const SchoolVerificationTab = ({ school }) => {
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!school?._id) return;
    setLoading(true);
    try {
      const result = await getVerificationStatus(school._id);
      setStatus(result);
    } catch (err) {
      toast.error(err.message || 'Failed to load verification status.');
    } finally {
      setLoading(false);
    }
  }, [school?._id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = useCallback(async () => {
    if (!school?._id) return;
    setBusy(true);
    try {
      await adminVerifySchool(school._id, { decision: 'approved' });
      toast.success('School verification approved.');
      await load();
    } catch (err) {
      toast.error(err.message || 'Approval failed.');
    } finally {
      setBusy(false);
    }
  }, [school?._id, toast, load]);

  const handleReject = useCallback(async () => {
    if (!school?._id || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason.');
      return;
    }
    setBusy(true);
    try {
      await adminVerifySchool(school._id, { decision: 'rejected', rejectionReason: rejectionReason.trim() });
      toast.success('School verification rejected.');
      setRejecting(false);
      setRejectionReason('');
      await load();
    } catch (err) {
      toast.error(err.message || 'Rejection failed.');
    } finally {
      setBusy(false);
    }
  }, [school?._id, rejectionReason, toast, load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderCircle className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!status) {
    return <p className="text-sm text-slate-500">No verification data available.</p>;
  }

  const isPending = status.verificationStatus === 'PENDING_REVIEW';
  const isVerified = status.verificationStatus === 'VERIFIED';
  const isRejected = status.verificationStatus === 'REJECTED';

  return (
    <div className="space-y-6">
      <Card padding="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-extrabold text-ink">Verification Status</h2>
          <Badge tone={isVerified ? 'green' : isRejected ? 'red' : isPending ? 'amber' : 'slate'}>
            {status.verificationStatus?.replace(/_/g, ' ')}
          </Badge>
        </div>
        <p className="text-[12px] font-medium text-slate-500">
          Tier {status.verificationTier} — {status.verificationTier === 2 ? 'Fully Verified' : status.verificationTier === 1 ? 'Directory Matched / Pending' : 'Unverified'}
        </p>
        {status.rejectionReason && (
          <p className="mt-2 text-[12px] font-medium text-red-600">{status.rejectionReason}</p>
        )}
        {status.verifiedAt && (
          <p className="mt-2 text-[11px] text-slate-400">Verified at: {new Date(status.verifiedAt).toLocaleString()}</p>
        )}
      </Card>

      <Card padding="p-5">
        <h2 className="text-[13px] font-extrabold text-ink mb-4">Uploaded Documents</h2>
        {status.documents?.uploaded?.length === 0 ? (
          <p className="text-sm text-slate-500">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-3">
            {(status.documents?.uploaded || []).map((doc) => (
              <div key={doc.type} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <FileText className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-ink">{DOCUMENT_LABELS[doc.type] || doc.type}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    {doc.reviewStatus === 'APPROVED' && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                      </span>
                    )}
                    {doc.reviewStatus === 'PENDING' && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                        <LoaderCircle className="h-3.5 w-3.5" /> Pending
                      </span>
                    )}
                    {doc.reviewStatus === 'REJECTED' && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-red-600">
                        <XCircle className="h-3.5 w-3.5" /> Rejected
                      </span>
                    )}
                    <a href={doc.fileUrl} target="_blank" rel="noreferrer noopener" className="text-[11px] font-medium text-brand-700 hover:underline">
                      View file
                    </a>
                  </div>
                  {doc.reviewNote && (
                    <p className="mt-1 text-[11px] text-red-600">{doc.reviewNote}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {status.documents?.missing?.length > 0 && (
          <p className="mt-3 text-[11px] font-medium text-amber-600">
            Missing: {status.documents.missing.map((d) => DOCUMENT_LABELS[d] || d).join(', ')}
          </p>
        )}
      </Card>

      {isPending && (
        <Card padding="p-5">
          <h2 className="text-[13px] font-extrabold text-ink mb-4">Review Decision</h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleApprove}
              disabled={busy || (status.documents?.missing?.length > 0)}
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white shadow-lift transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Approve
            </button>
            <button
              type="button"
              onClick={() => setRejecting(!rejecting)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </button>
          </div>

          {rejecting && (
            <div className="mt-4 space-y-3">
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason (required)..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-ink placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/30"
              />
              <button
                type="button"
                onClick={handleReject}
                disabled={busy || !rejectionReason.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-lift transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Confirm Rejection
              </button>
            </div>
          )}
        </Card>
      )}

      {isRejected && (
        <Card padding="p-5">
          <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-bold text-red-800">Verification Rejected</p>
              <p className="mt-1 text-[12px] text-red-700">{status.rejectionReason}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default SchoolVerificationTab;