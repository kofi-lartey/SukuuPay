import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../hooks/useEntitlements';
import { useCampuses, useCreateCampus } from '../hooks/useCampus';
import { getLmsItems, createLmsItem } from '../services/lmsApi';
import CampusContentFilter from '../components/lms/CampusContentFilter';
import LmsItemCard from '../components/lms/LmsItemCard';
import LmsContentForm from '../components/lms/LmsContentForm';
import Modal from '../components/common/Modal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Monitor, Layout } from 'lucide-react';

export default function LmsCampusView() {
  const { user } = useAuth();
  const ent = useEntitlements();
  const schoolId = user?.schoolId;

  if (ent.currentTier !== 'growth') {
    return <div className="p-6">This feature is part of Version 2 (multi-campus LMS). Contact sales for early access.</div>;
  }

  const { data: campuses = [], isLoading } = useCampuses(schoolId);
  const [activeCampus, setActiveCampus] = useState(null);
  const [open, setOpen] = useState(false);
  const [sharingScope, setSharingScope] = useState('school');

  const qc = useQueryClient();

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ['lmsItems', schoolId, activeCampus, sharingScope],
    queryFn: () =>
      getLmsItems({ schoolId, campusId: activeCampus || undefined, sharingScope: sharingScope === 'school' ? undefined : activeCampus }),
    enabled: Boolean(schoolId),
  });

  const create = useMutation({
    mutationFn: (data) => createLmsItem({ ...data, schoolId, campusId: activeCampus || null, sharingScope }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lmsItems'] });
      setOpen(false);
    },
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">LMS — Multi-Campus Content</h1>
        <div className="flex gap-2">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
            onClick={() => { setSharingScope('school'); setOpen(true); }}
          >
            <Plus className="w-4 h-4" /> School-wide Content
          </button>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
            onClick={() => { setSharingScope('campus'); setOpen(true); }}
          >
            <Monitor className="w-4 h-4" /> Campus Content
          </button>
        </div>
      </div>

      {isLoading || loadingItems ? (
        <p>Loading content...</p>
      ) : (
        <div className="space-y-4">
          <CampusContentFilter
            campuses={campuses}
            activeCampus={activeCampus}
            onChange={setActiveCampus}
            sharingScope={sharingScope}
            onScopeChange={setSharingScope}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <LmsItemCard key={item._id} item={item} />
            ))}
            {items.length === 0 && (
              <div className="col-span-3 text-slate-400 text-sm text-center py-8">
                No content for this scope.
              </div>
            )}
          </div>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Create LMS Content">
        <LmsContentForm
          campuses={campuses}
          sharingScope={sharingScope}
          onSubmit={(data) => create.mutate(data)}
          loading={create.isPending}
        />
      </Modal>
    </div>
  );
}
