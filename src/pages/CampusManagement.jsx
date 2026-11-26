import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../hooks/useEntitlements';
import { useCampuses, useCreateCampus, useUpdateCampus, useArchiveCampus } from '../hooks/useCampus';
import CampusList from '../components/campus/CampusList';
import CampusForm from '../components/campus/CampusForm';
import CampusSwitcher from '../components/campus/CampusSwitcher';
import Modal from '../components/common/Modal';
import { Building2, Users, Mail, Calendar } from 'lucide-react';

const STATS = [
  { label: 'Total campuses', key: 'total', icon: Building2 },
  { label: 'Active', key: 'active', icon: Calendar },
  { label: 'Bursars', key: 'bursars', icon: Mail },
];

export default function CampusManagement() {
  const { user } = useAuth();
  const ent = useEntitlements();
  const schoolId = user?.schoolId;
  const { data: campuses = [], isLoading } = useCampuses(schoolId);
  const create = useCreateCampus();
  const update = useUpdateCampus();
  const archive = useArchiveCampus();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [active, setActive] = useState('');

  const activeCount = campuses.filter((c) => c.status === 'active').length;
  const bursarCount = campuses.filter((c) => c.bursarEmail).length;

  if (ent.currentTier !== 'growth') {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Campus Management</h1>
        </div>
        <div className="rounded-lg border border-slate-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-800">Version 2 Feature</h2>
          <p className="mt-1 text-sm text-amber-700">
            Multi-campus management is part of Version 2. Contact sales for early access.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = (form) => {
    if (editing) update.mutate({ id: editing._id, data: form }, { onSuccess: () => setOpen(false) });
    else create.mutate({ ...form, schoolId }, { onSuccess: () => setOpen(false) });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campus Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Add, edit and archive campuses for {user?.schoolId ? 'your school' : ''}.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setOpen(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
        >
          <Building2 className="h-4 w-4" /> New Campus
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {STATS.map((s) => (
          <div key={s.key} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 text-slate-500">
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{s.label}</p>
                <p className="text-xl font-bold text-ink">{s.key === 'total' ? campuses.length : s.key === 'active' ? activeCount : bursarCount}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <p className="text-slate-500">Loading campuses…</p>
      ) : campuses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <Building2 className="mx-auto h-8 w-8 text-slate-300 mb-3" />
          <h3 className="text-sm font-semibold text-ink">No campuses yet</h3>
          <p className="mt-1 text-sm text-slate-500">
            Create your first campus to begin managing multiple sites.
          </p>
        </div>
      ) : (
        <CampusList
          campuses={campuses.filter((c) => active === '' || c._id === active)}
          onEdit={(c) => { setEditing(c); setOpen(true); }}
          onArchive={(id) => archive.mutate(id)}
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Campus' : 'Create Campus'} size="sm">
        <CampusForm campus={editing} onSubmit={handleSubmit} loading={create.isPending || update.isPending} />
      </Modal>
    </div>
  );
}
