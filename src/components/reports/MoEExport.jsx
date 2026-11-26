export default function MoEExport() {
  const moeColumns = [
    'EMIS Code',
    'Student Name',
    'Class',
    'Term',
    'Academic Year',
    'Fees Assessed',
    'Fees Paid',
    'Balance',
    'Payment Date',
    'Receipt Number',
    'Audit Actor',
    'Timestamp',
  ];

  return (
    <div className="border border-slate-100 rounded-lg p-4">
      <h3 className="font-semibold text-slate-800 mb-2">MoE Compliance Column Mapping</h3>
      <p className="text-xs text-slate-500 mb-3">
        Fixed column order per Ghana Ministry of Education requirements. This schema
        is owned by SukuuPay and ships with the Growth tier.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1">
        {moeColumns.map((col) => (
          <span key={col} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100">
            {col}
          </span>
        ))}
      </div>
    </div>
  );
}
