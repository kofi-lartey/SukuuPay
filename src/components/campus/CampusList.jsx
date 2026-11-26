import { Building2, Mail } from 'lucide-react';

const statusVariant = (status) => ({
  active: 'bg-green-50 text-green-700 border-green-100',
  inactive: 'bg-amber-50 text-amber-700 border-amber-100',
  archived: 'bg-slate-50 text-slate-500 border-slate-100',
}[status] || 'bg-slate-50 text-slate-500 border-slate-100');

export default function CampusList({ campuses = [], onEdit, onArchive }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <table className="w-full text-sm divide-y divide-slate-100">
        <thead>
          <tr className="text-left bg-slate-50">
            <th className="py-3 px-4 font-semibold text-slate-600">Name</th>
            <th className="py-3 px-4 font-semibold text-slate-600">Code</th>
            <th className="py-3 px-4 font-semibold text-slate-600">Region</th>
            <th className="py-3 px-4 font-semibold text-slate-600">Status</th>
            <th className="py-3 px-4 font-semibold text-slate-600">Bursar</th>
            <th className="py-3 px-4 font-semibold text-slate-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {campuses.map((c) => (
            <tr key={c._id} className="hover:bg-slate-50 transition-colors">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-3 w-3 text-slate-400" />
                  <span className="font-medium text-ink">{c.name}</span>
                </div>
              </td>
              <td className="py-3 px-4 font-mono text-slate-600">{c.code}</td>
              <td className="py-3 px-4 text-slate-600">{c.region || '—'}</td>
              <td className="py-3 px-4">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusVariant(c.status)}`}
                >
                  {c.status}
                </span>
              </td>
              <td className="py-3 px-4">
                {c.bursarEmail ? (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3 text-slate-400" />
                    <span className="text-slate-600 truncate max-w-xs">{c.bursarEmail}</span>
                  </div>
                ) : (
                  <span className="text-slate-400 text-[11px]">—</span>
                )}
              </td>
              <td className="py-3 px-4 space-x-2">
                <button className="text-blue-600 text-sm font-medium hover:underline" onClick={() => onEdit(c)}>
                  Edit
                </button>
                <button className="text-red-600 text-sm font-medium hover:underline" onClick={() => onArchive(c._id)}>
                  Archive
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
