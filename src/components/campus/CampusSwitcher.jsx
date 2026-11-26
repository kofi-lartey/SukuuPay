export default function CampusSwitcher({ campuses = [], value, onChange }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="border rounded px-2 py-1">
      <option value="">All campuses</option>
      {campuses.map((c) => (
        <option key={c._id} value={c._id}>{c.name}</option>
      ))}
    </select>
  );
}
