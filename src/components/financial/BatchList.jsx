export default function BatchList({ batches = [], onSign, onApprove, onReject, onDetail }) {
  if (!batches.length) {
    return <div className="text-slate-500 text-sm text-center py-8">No pending batches.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-slate-100">
        <thead>
          <tr className="text-left border-b bg-slate-50">
            <th className="py-2 px-3 font-semibold text-slate-600">Batch</th>
            <th className="py-2 px-3 font-semibold text-slate-600">Campus</th>
            <th className="py-2 px-3 font-semibold text-slate-600">Amount</th>
            <th className="py-2 px-3 font-semibold text-slate-600">Signatures</th>
            <th className="py-2 px-3 font-semibold text-slate-600">Status</th>
            <th className="py-2 px-3 font-semibold text-slate-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => (
            <tr key={b._id} className="border-b">
              <td className="py-2 px-3 font-medium">{b.batchNumber || b._id.slice(-6)}</td>
              <td className="py-2 px-3">{b.campusId?.name || '—'}</td>
              <td className="py-2 px-3">GH₵ {(b.amount || 0) / 100}</td>
              <td className="py-2 px-3">
                {b.signatureCount || 0} / {b.requiredSignatures || 1}
              </td>
              <td className="py-2 px-3">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    b.status === 'pending_approval'
                      ? 'bg-amber-100 text-amber-700'
                      : b.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {b.status.replace('_', ' ')}
                </span>
              </td>
              <td className="py-2 px-3 space-x-2">
                {b.status === 'pending_approval' && (
                  <>
                    <button
                      onClick={() => onSign(b._id)}
                      className="text-blue-600 text-xs underline"
                    >
                      Sign
                    </button>
                    {b.signatureCount >= (b.requiredSignatures || 1) && (
                      <button
                        onClick={() => onApprove(b._id)}
                        className="text-green-600 text-xs underline"
                      >
                        Approve
                      </button>
                    )}
                    <button
                      onClick={() => onReject(b._id, '')}
                      className="text-red-600 text-xs underline"
                    >
                      Reject
                    </button>
                  </>
                )}
                <button onClick={() => onDetail(b._id)} className="text-slate-600 text-xs underline">
                  Detail
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
