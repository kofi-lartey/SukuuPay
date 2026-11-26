export default function ExportPreview({ columns = [], rows = [] }) {
  if (!rows.length) {
    return <div className="text-slate-400 text-sm text-center py-4">No data to preview.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border border-slate-100">
        <thead>
          <tr className="border-b bg-slate-50">
            {columns.map((col) => (
              <th key={col} className="px-2 py-1 text-left font-semibold text-slate-600">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 5).map((row, i) => (
            <tr key={i} className="border-b">
              {columns.map((col) => (
                <td key={col} className="px-2 py-1 text-slate-700">
                  {row[col] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
          {rows.length > 5 && (
            <tr>
              <td colSpan={columns.length} className="px-2 py-1 text-slate-400 text-xs italic">
                Showing 5 of {rows.length} rows
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
