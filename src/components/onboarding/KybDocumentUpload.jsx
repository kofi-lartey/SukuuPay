import React, { useState, useCallback } from 'react';
import { FileText, Upload, CheckCircle2, AlertCircle, LoaderCircle, Trash2, Clock } from 'lucide-react';
import { uploadVerificationDocument, getVerificationStatus } from '../../services/verification';
import { useToast } from '../../hooks/useToast';

const DOCUMENT_TYPES = [
  { type: 'NASIA_LICENSE', label: 'NaSIA License / Registration', description: 'Certificate of Registration from NaSIA or EMIS confirmation' },
  { type: 'RGD_CERTIFICATE', label: 'RGD Certificate', description: 'Certificate of Incorporation / Business Registration' },
  { type: 'AUTHORIZATION_LETTER', label: 'Authorization Letter', description: 'Headteacher / Proprietor authorization letter' },
  { type: 'HEADTEACHER_ID', label: 'Headteacher ID', description: 'Government-issued ID of Headteacher / Proprietor' },
];

const REQUIRED_TYPES = ['NASIA_LICENSE', 'RGD_CERTIFICATE', 'AUTHORIZATION_LETTER'];

const KybDocumentUpload = ({ schoolId, onStatusChange }) => {
  const toast = useToast();
  const [uploading, setUploading] = useState({});
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const result = await getVerificationStatus(schoolId);
      setStatus(result);
      if (onStatusChange) onStatusChange(result);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [schoolId, onStatusChange]);

  React.useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleFileSelect = useCallback(async (documentType, file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File is larger than 10 MB.');
      return;
    }
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only PDF, JPG, PNG, or WebP files are allowed.');
      return;
    }

    setUploading((prev) => ({ ...prev, [documentType]: true }));
    try {
      await uploadVerificationDocument(schoolId, documentType, file);
      toast.success(`${DOCUMENT_TYPES.find((d) => d.type === documentType)?.label} uploaded.`);
      await loadStatus();
    } catch (error) {
      toast.error(error.message || 'Upload failed.');
    } finally {
      setUploading((prev) => ({ ...prev, [documentType]: false }));
    }
  }, [schoolId, toast, loadStatus]);

  const getDocumentStatus = (type) => {
    if (!status?.documents?.uploaded) return null;
    return status.documents.uploaded.find((d) => d.type === type);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-extrabold text-ink">KYB Verification Documents</h3>
        {status && (
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
            status.verificationStatus === 'VERIFIED' ? 'bg-green-100 text-green-700' :
            status.verificationStatus === 'PENDING_REVIEW' ? 'bg-amber-100 text-amber-700' :
            status.verificationStatus === 'REJECTED' ? 'bg-red-100 text-red-700' :
            'bg-slate-100 text-slate-600'
          }`}>
            {status.verificationStatus?.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {status?.rejectionReason && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
          {status.rejectionReason}
        </div>
      )}

      <div className="space-y-3">
        {DOCUMENT_TYPES.map((doc) => {
          const uploaded = getDocumentStatus(doc.type);
          const isRequired = REQUIRED_TYPES.includes(doc.type);
          const isUploading = uploading[doc.type];

          return (
            <div
              key={doc.type}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                <FileText className="h-5 w-5 text-slate-400" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-bold text-ink">{doc.label}</p>
                  {isRequired && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                      Required
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500">{doc.description}</p>
                {uploaded && (
                  <div className="mt-2 flex items-center gap-2">
                    {uploaded.reviewStatus === 'APPROVED' && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Approved
                      </span>
                    )}
                    {uploaded.reviewStatus === 'PENDING' && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        Pending review
                      </span>
                    )}
                    {uploaded.reviewStatus === 'REJECTED' && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-red-600">
                        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        Rejected
                      </span>
                    )}
                    <a
                      href={uploaded.fileUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-[11px] font-medium text-brand-700 hover:underline"
                    >
                      View file
                    </a>
                  </div>
                )}
              </div>
              <label className="shrink-0">
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) handleFileSelect(doc.type, file);
                  }}
                  disabled={isUploading}
                />
                <span className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-bold transition-colors ${
                  isUploading
                    ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}>
                  {isUploading ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {uploaded ? 'Replace' : 'Upload'}
                </span>
              </label>
            </div>
          );
        })}
      </div>

      {status?.documents?.missing?.length > 0 && (
        <p className="text-[11px] font-medium text-slate-500">
          Missing required: {status.documents.missing.join(', ').replace(/_/g, ' ')}
        </p>
      )}

      {status?.canUpgradeToVerified && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-[12px] font-medium text-green-700">
          All required documents uploaded. Your submission is pending review.
        </div>
      )}
    </div>
  );
};

export default KybDocumentUpload;