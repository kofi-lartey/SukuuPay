import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, UserCheck, Users } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import Modal from '../../../components/common/Modal';
import { SkeletonRow } from '../../../components/parent/shared/Skeleton';
import EmptyState from '../../../components/parent/shared/EmptyState';
import { useClasses } from '../../../hooks/admin/useClasses';
import { createClass, archiveClass } from '../../../services/admin/academic';
import { useToast } from '../../../hooks/useToast';
import { formatCount } from '../../../utils/format';
import { ACADEMICS_ROUTES } from '../../../utils/constants';

const CreateClassDialog = ({ open, onClose, onCreated }) => {
  const { success, error: toastError } = useToast();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onCreate = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toastError('A class name needs at least two characters.');
      return;
    }
    setSubmitting(true);
    try {
      await createClass({ className: trimmed });
      success(`Class “${trimmed}” created.`);
      onCreated?.();
      onClose();
    } catch (e) {
      toastError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a class"
      description="A class is a name on this school's list. Add the name, then assign teachers from the class detail."
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-brand-800"
            disabled={submitting || name.trim().length < 2}
          >
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
          Class name
        </label>
        <input
          type="text"
          placeholder="e.g. JHS 2A"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink"
          maxLength={50}
        />
      </div>
    </Modal>
  );
};

const Classes = () => {
  const [reloadKey, setReloadKey] = useState(0);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { items, loading, error } = useClasses(reloadKey);

  const refetch = () => setReloadKey((n) => n + 1);
  const onArchive = async (className) => {
    if (!confirm(`Archive “${className}”? Students in it must be moved first.`)) return;
    try {
      await archiveClass(className);
      refetch();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Academics"
        title="Classes"
        description="Class names on this school's list, with their student and teacher counts."
        actions={
          <>
            {/*
              The way into Teacher Assignment from the sibling that most often
              gets confused with it.

              Both screens answer "who teaches whom", and the difference is the
              unit: this one is per *class* (`User.assignedClasses`), that one is
              per *student*. An admin standing here looking for a student
              assignment should not have to guess which rail entry it is — one
              link, and the two surfaces stop competing for the same question.
            */}
            <button
              type="button"
              onClick={() => navigate(ACADEMICS_ROUTES.teacherAssignment)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <UserCheck className="h-4 w-4" aria-hidden="true" />
              Assign students
            </button>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-brand-800"
          >
            <Plus className="h-4 w-4" /> New class
          </button>
          </>
        }
      />

      <Card padding="p-0" className="shadow-none">
        {loading ? (
          <SkeletonRow />
        ) : error ? (
          <p className="p-4 text-sm text-red-600">{error.message || 'The class list could not be loaded.'}</p>
        ) : !items.length ? (
          <EmptyState
            icon={Users}
            title="No classes yet"
            description="Each class name is entered once and shared by students, marks and reports."
            action={
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-brand-800"
              >
                <Plus className="h-4 w-4" /> New class
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2.5">Class</th>
                  <th className="px-4 py-2.5">Students</th>
                  <th className="px-4 py-2.5">Teachers</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((c) => (
                  <tr key={c.className}>
                    <td className="px-4 py-2.5 font-extrabold text-ink">{c.className}</td>
                    <td className="px-4 py-2.5">{formatCount(c.studentCount || 0)}</td>
                    <td className="px-4 py-2.5">{formatCount(c.teacherCount || 0)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(ACADEMICS_ROUTES.classesDetail(c.className))}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                        title="Manage teachers"
                      >
                        Manage
                      </button>
                      <button
                        type="button"
                        onClick={() => onArchive(c.className)}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-extrabold text-red-700 hover:bg-red-50"
                        title="Archive (moves students first)"
                        disabled={c.studentCount > 0}
                      >
                        Archive
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateClassDialog open={creating} onClose={() => setCreating(false)} onCreated={refetch} />
    </>
  );
};

export default Classes;
