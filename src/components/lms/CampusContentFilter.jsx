export default function CampusContentFilter({ campuses = [], activeCampus, onChange, sharingScope, onScopeChange }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-slate-50 rounded-lg border border-slate-100">
      <label className="text-xs font-bold text-slate-600 uppercase">View:</label>
      <select
        value={activeCampus || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="border border-slate-200 rounded px-2 py-1 text-sm"
      >
        <option value="">All campuses (school-wide)</option>
        {campuses.map((c) => (
          <option key={c._id} value={c._id}>
            {c.name}
          </option>
        ))}
      </select>

      <label className="text-xs font-bold text-slate-600 uppercase mx-4">Scope:</label>
      <div className="flex gap-1">
        {['school', 'campus'].map((scope) => (
          <button
            key={scope}
            onClick={() => onScopeChange(scope)}
            className={`px-3 py-1 text-sm rounded border ${
              sharingScope === scope
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {scope === 'school' ? 'School-wide' : 'Campus-only'}
          </button>
        ))}
      </div>
    </div>
  );
}
