import { useState } from 'react';
import FormField from '../common/FormField';

const initial = { campusId: '', amount: '', description: '', requiredSignatures: 1 };

export default function BatchForm({ onSubmit, loading, campuses = [] }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
      <FormField label="Campus" required>
        <select value={form.campusId} onChange={(e) => set('campusId', e.target.value)} required>
          <option value="">Select campus</option>
          {campuses.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Amount (pesewas)" hint="Integer amount in pesewas (1 GHS = 100 pesewas)" required>
        <input
          type="number"
          value={form.amount}
          onChange={(e) => set('amount', e.target.value)}
          required
        />
      </FormField>

      <FormField label="Description">
        <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} />
      </FormField>

      <FormField label="Required Signatures" hint="How many signatories must approve before funds move">
        <input
          type="number"
          value={form.requiredSignatures}
          onChange={(e) => set('requiredSignatures', Number(e.target.value) || 1)}
          min="1"
        />
      </FormField>

      <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded">
        {loading ? 'Creating...' : 'Create Batch'}
      </button>
    </form>
  );
}
