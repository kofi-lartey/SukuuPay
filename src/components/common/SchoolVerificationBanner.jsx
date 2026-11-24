import React from 'react';
import { AlertCircle, CheckCircle2, Clock, Shield, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';

const TIER_LABELS = {
  0: 'Unverified',
  1: 'Directory Matched',
  2: 'Fully Verified',
};

const STATUS_CONFIG = {
  UNVERIFIED: {
    icon: Shield,
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    title: 'School not yet verified',
    description: 'Upload verification documents to unlock fee collection and production features.',
    cta: 'Complete Verification',
    ctaColor: 'bg-brand-700 text-white hover:bg-brand-800',
  },
  DIRECTORY_MATCHED: {
    icon: CheckCircle2,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    title: 'Matched with Ghana School Directory',
    description: 'Your school was found in the Ghana directory. Upload KYB documents to reach full verification.',
    cta: 'Complete KYB Verification',
    ctaColor: 'bg-brand-700 text-white hover:bg-brand-800',
  },
  PENDING_REVIEW: {
    icon: Clock,
    iconColor: 'text-amber-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    title: 'Verification under review',
    description: 'Your documents are being reviewed. You will be notified once verified.',
    cta: null,
    ctaColor: '',
  },
  VERIFIED: {
    icon: CheckCircle2,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    title: 'School verified',
    description: 'Your school is fully verified. All features are unlocked.',
    cta: null,
    ctaColor: '',
  },
  REJECTED: {
    icon: AlertCircle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    title: 'Verification rejected',
    description: null,
    cta: 'Re-upload Documents',
    ctaColor: 'bg-red-600 text-white hover:bg-red-700',
  },
};

const SchoolVerificationBanner = ({ school, onUploadClick, className = '' }) => {
  if (!school) return null;

  const status = school.verificationStatus || 'UNVERIFIED';
  const tier = school.verificationTier ?? 0;
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.UNVERIFIED;
  const Icon = config.icon;

  if (status === 'VERIFIED') {
    return (
      <div className={`flex items-center gap-3 rounded-xl border ${config.borderColor} ${config.bgColor} px-4 py-3 ${className}`}>
        <Icon className={`h-5 w-5 ${config.iconColor}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold text-ink">{config.title}</p>
          <p className="mt-0.5 text-[12px] font-medium text-slate-600">{config.description}</p>
        </div>
        <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-700">
          Tier {tier} - {TIER_LABELS[tier]}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 rounded-xl border ${config.borderColor} ${config.bgColor} px-4 py-3 sm:flex-row sm:items-center ${className}`}>
      <Icon className={`h-5 w-5 ${config.iconColor} shrink-0`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-extrabold text-ink">{config.title}</p>
        <p className="mt-0.5 text-[12px] font-medium text-slate-600">
          {status === 'REJECTED' && school.rejectionReason
            ? school.rejectionReason
            : config.description}
        </p>
        {status === 'PENDING_REVIEW' && (
          <p className="mt-1 text-[11px] font-medium text-amber-700">
            Documents uploaded: {school.kybDocuments?.length || 0}
          </p>
        )}
      </div>
      {config.cta && (
        <Link
          to="/dashboard/settings?section=verification"
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-bold transition-colors ${config.ctaColor}`}
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          {config.cta}
        </Link>
      )}
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
        Tier {tier} - {TIER_LABELS[tier]}
      </span>
    </div>
  );
};

export default SchoolVerificationBanner;