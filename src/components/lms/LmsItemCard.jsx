export default function LmsItemCard({ item }) {
  const isSchoolWide = !item.campusId || item.sharingScope === 'school';

  return (
    <div className="border border-slate-100 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-slate-800">{item.title}</h3>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
            isSchoolWide
              ? 'bg-blue-50 text-blue-700 border-blue-100'
              : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}
        >
          {isSchoolWide ? 'School-wide' : 'Campus-only'}
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-2 line-clamp-2">{item.description || ''}</p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{item.type || 'item'}</span>
        {item.campusId?.name && (
          <span className="text-slate-400">• {item.campusId.name}</span>
        )}
      </div>
    </div>
  );
}
