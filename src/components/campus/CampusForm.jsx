import { useState } from 'react';
import { Field, SelectField } from '../common/FormField';

const initial = { name: '', code: '', address: '', region: '', bursarEmail: '', status: 'active' };

export default function CampusForm({ campus, onSubmit, loading }) {
  const [form, setForm] = useState(campus || initial);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
      <Field label="Name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
      <Field label="Code" required value={form.code} onChange={(e) => set('code', e.target.value)} />
      <Field label="Address" value={form.address} onChange={(e) => set('address', e.target.value)} />
      <Field label="Region" value={form.region} onChange={(e) => set('region', e.target.value)} />
      <Field label="Bursar Email" type="email" value={form.bursarEmail} onChange={(e) => set('bursarEmail', e.target.value)} />
      <SelectField label="Status" value={form.status} onChange={(e) => set('status', e.target.value)}>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </SelectField>
      <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded">{loading ? 'Saving...' : 'Save'}</button>
    </form>
  );
}
