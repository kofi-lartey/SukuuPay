import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../hooks/useEntitlements';
import { useBatches, useCreateBatch, useSignBatch, useApproveBatch, useRejectBatch } from '../hooks/useFinancialBatches';
import BatchList from '../components/financial/BatchList';
import BatchForm from '../components/financial/BatchForm';
import Modal from '../components/common/Modal';
import { Plus } from 'lucide-react';

export default function FinancialBatches() {
  const { user } = useAuth();
  const ent = useEntitlements();
  const schoolId = user?.schoolId;

  if (ent.currentTier !== 'growth') {
    return <div className="p-6">This feature is part of Version 2 (multi-campus). Contact sales for early access.</div>;
  }

  const { data: batches = [], isLoading } = useBatches({ schoolId, status: 'pending_approval' });
  const create = useCreateBatch();
  const sign = useSignBatch();
  const approve = useApproveBatch();
  const reject = useRejectBatch();

  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Financial Batches</h1>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
          onClick={() => setOpen(true)}
        >
          <Plus className="w-4 h-4" /> New Batch
        </button>
      </div>

      {isLoading ? (
        <p>Loading batches...</p>
      ) : (
        <BatchList
          batches={batches}
          onSign={(id) => sign.mutate(id)}
          onApprove={(id) => approve.mutate(id)}
          onReject={(id) => reject.mutate({ id, reason: '' })}
          onDetail={(id) => setDetailId(id)}
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Create Disbursement Batch">
        <BatchForm onSubmit={(data) => create.mutate({ ...data, schoolId })} loading={create.isPending} />
      </Modal>

      {detailId && (
        <BatchDetailModal
          id={detailId}
          open={Boolean(detailId)}
          onClose={() => setDetailId(null)}
          onSign={() => sign.mutate(detailId)}
          onApprove={() => approve.mutate(detailId)}
          onReject={(reason) => reject.mutate({ id: detailId, reason })}
        />
      )}
    </div>
  );
}

function BatchDetailModal({ id, open, onClose, onSign, onApprove, onReject }) {
  const { data: batch, isLoading } = useBatch(id);
  const [rejectReason, setRejectReason] = useState('');

  if (!open || !batch) return null;

  const alreadySigned = batch.signatures?.some((s) => s.userId === 'current') ?? false;
  const remaining = Math.max(0, (batch.requiredSignatures || 1) - (batch.signatureCount || 0));

  return (
    <Modal open={open} onClose={onClose} title={`Batch ${batch.batchNumber || id}`} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 p-3 rounded-lg">
            <p className="text-xs text-slate-500">Campus</p>
            <p className="font-medium">{batch.campusId?.name || '—'}</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg">
            <p className="text-xs text-slate-500">Amount</p>
            <p className="font-medium">GH₵ {(batch.amount || 0) / 100}</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg">
            <p className="text-xs text-slate-500">Signatures</p>
            <p className="font-medium">{batch.signatureCount || 0} / {batch.requiredSignatures || 1}</p>
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg">
          <p className="text-xs text-slate-500">Description</p>
          <p className="font-medium">{batch.description || '—'}</p>
        </div>

        {remaining > 0 && !alreadySigned ? (
          <button
            onClick={() => onSign()}
            disabled={sign.isPending}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {sign.isPending ? 'Signing...' : 'Sign Batch'}
          </button>
        ) : alreadySigned ? (
          <p className="text-sm text-green-600">You have already signed this batch.</p>
        ) : null}

        {remaining > 0 && !alreadySigned ? (
          <div className="mt-4">
            <label className="text-xs font-bold text-slate-700 block mb-1">Reject reason</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded"
              rows={2}
            />
            <button
              onClick={() => onReject(rejectReason)}
              disabled={reject.isPending}
              className="mt-2 bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {reject.isPending ? 'Rejecting...' : 'Reject Batch'}
            </button>
          </div>
        ) : null}

        {batch.status === 'approved' ? (
          <p className="text-sm text-green-600">Batch approved — funds released.</p>
        ) : batch.status === 'rejected' ? (
          <p className="text-sm text-red-600">Batch rejected.</p>
        ) : null}
      </div>
    </Modal>
  );
}
