import { useState } from 'react';
import FormField from '../common/FormField';

const initial = { title: '', description: '', type: 'lesson', content: '' };

export default function LmsContentForm({ campuses = [], sharingScope, onSubmit, loading }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const campusRequired = sharingScope === 'campus';

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
      <FormField label="Title" required>
        <input value={form.title} onChange={(e) => set('title', e.target.value)} required />
      </FormField>

      <FormField label="Type">
        <select value={form.type} onChange={(e) => set('type', e.target.value)}>
          <option value="lesson">Lesson</option>
          <option value="resource">Resource</option>
          <option value="assessment">Assessment</option>
          <option value="studyplan">Study Plan</option>
        </select>
      </FormField>

      <FormField label="Description">
        <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} />
      </FormField>

      <FormField label="Content">
        <textarea value={form.content} onChange={(e) => set('content', e.target.value)} rows={3} />
      </FormField>

      {campusRequired && (
        <FormField label="Campus" required>
          <select value={form.campusId || ''} onChange={(e) => set('campusId', e.target.value)} required>
            <option value="">Select campus</option>
            {campuses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>
      )}

      <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded">
        {loading ? 'Creating...' : 'Create Content'}
      </button>
    </form>
  );
}
