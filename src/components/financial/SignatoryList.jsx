export default function SignatoryList({ signatures = [], requiredSignatures = 1 }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="font-semibold text-slate-600">Signatories</span>
        <span className="font-medium text-ink">
          {signatures.length} / {requiredSignatures}
        </span>
      </div>
      {signatures.length ? (
        <div className="space-y-1">
          {signatures.map((s) => (
            <div key={s.userId} className="flex items-center justify-between text-sm">
              <span className="text-slate-600">{s.userId?.name || s.userId || 'Unknown'}</span>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                Signed {new Date(s.signedAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">No signatures yet.</p>
      )}
    </div>
  );
}
