export default function BatchSignature({ batch, onSign, onApprove, onReject }) {
  const remaining = Math.max(0, (batch.requiredSignatures || 1) - (batch.signatureCount || 0));

  return (
    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-600">Signature status</span>
        <span className="text-xs font-medium">
          {batch.signatureCount || 0} / {batch.requiredSignatures || 1}
        </span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full"
          style={{ width: `${Math.min(100, (((batch.signatureCount || 0) / Math.max(1, batch.requiredSignatures || 1)) * 100))}%` }}
        />
      </div>

      {remaining > 0 ? (
        <div className="mt-3 flex gap-2">
          <button onClick={onSign} className="flex-1 bg-blue-600 text-white py-2 rounded text-sm">
            Sign Batch
          </button>
          <button onClick={onApprove} className="flex-1 bg-green-600 text-white py-2 rounded text-sm disabled:opacity-50">
            Approve
          </button>
          <button onClick={onReject} className="flex-1 bg-red-600 text-white py-2 rounded text-sm">
            Reject
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-green-600 font-medium">All signatures collected.</p>
      )}
    </div>
  );
}
