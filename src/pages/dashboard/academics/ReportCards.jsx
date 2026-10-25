import React, { useState } from 'react';
import { FileText, Save, Edit, ExternalLink } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import Modal from '../../../components/common/Modal';
import { Field, SelectField } from '../../../components/common/FormField';
import { SkeletonRow } from '../../../components/parent/shared/Skeleton';
import EmptyState from '../../../components/parent/shared/EmptyState';
import { useClasses } from '../../../hooks/admin/useClasses';
import { setTeacherRemark, setHeadRemark, publishReports, unpublishReports } from '../../../services/admin/academic';
import { useToast } from '../../../hooks/useToast';
import { ACADEMIC_TERMS, ROUTES } from '../../../utils/constants';
import { formatCount } from '../../../utils/format';

const ReleaseModal = ({ open, onClose, row, onDone }) => {
  const { success, error: toastError } = useToast();
  const [term, setTerm] = useState('');
  const [year, setYear] = useState('');
  const [remark, setRemark] = useState('');
  const [teacherRemark, setTeacherRemarkState] = useState('');
  const [mode, setMode] = useState('publish');
  const [submitting, setSubmitting] = useState(false);

  const resetScope = () => {
    setTerm('');
    setYear('');
    setRemark('');
    setTeacherRemarkState('');
    setMode('publish');
  };

  const onSubmit = async () => {
    if (!term || !year) {
      toastError('Term and academic year are required.');
      return;
    }
    setSubmitting(true);
    try {
      if (remark.trim().length >= 3) {
        await setHeadRemark({ className: row.className, term, academicYear: year, text: remark });
      }
      if (teacherRemark.trim().length >= 3) {
        await setTeacherRemark({ className: row.className, term, academicYear: year, text: teacherRemark });
      }
      const res = mode === 'publish'
        ? await publishReports({ className: row.className, term, academicYear: year })
        : await unpublishReports({ className: row.className, term, academicYear: year });
      const n = mode === 'publish' ? res?.published : res?.unpublished;
      success(`${formatCount(n || 0)} report card${n === 1 ? '' : 's'} ${mode === 'publish' ? 'published' : 'unpublished'}.`);
      resetScope();
      onDone();
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
      onClose={() => { resetScope(); onClose(); }}
      title={mode === 'publish' ? 'Publish report cards' : 'Unpublish report cards'}
      description={`Release or unrelease ${row?.className}'s reports for one term. An optional remark is written to every card first.`}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={() => { resetScope(); onClose(); }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className={`px-4 py-2 text-sm font-extrabold text-white rounded-lg ${mode === 'publish' ? 'bg-brand-700 hover:bg-brand-800' : 'bg-red-700 hover:bg-red-800'}`}
            disabled={submitting || !term || !year}
          >
            {submitting ? 'Saving…' : mode === 'publish' ? 'Publish' : 'Unpublish'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <SelectField label="Action" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="publish">Publish reports</option>
          <option value="unpublish">Unpublish reports</option>
        </SelectField>
        <SelectField label="Term" value={term} onChange={(e) => setTerm(e.target.value)} required>
          <option value="">— pick a term —</option>
          {ACADEMIC_TERMS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </SelectField>
        <Field
          label="Academic year"
          placeholder="2025/2026"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          required
          maxLength={9}
        />
        <Field
          label="Head remark (optional)"
          placeholder="e.g. Strong finish to the term; keep an eye on participation."
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          maxLength={500}
          hint="3+ characters to be saved alongside the reports."
        />
        <Field
          label="Class teacher remark (optional)"
          placeholder="e.g. Good effort; needs to focus on homework."
          value={teacherRemark}
          onChange={(e) => setTeacherRemarkState(e.target.value)}
          maxLength={500}
          hint="3+ characters to be saved alongside the reports."
        />
      </div>
    </Modal>
  );
};

const ReportCards = () => {
  const [reloadKey, setReloadKey] = useState(0);
  const [openRow, setOpenRow] = useState(null);
  const { items, loading, error } = useClasses(reloadKey);
  const refetch = () => setReloadKey((n) => n + 1);

  return (
    <>
      <PageHeader
        eyebrow="Academics"
        title="Report cards"
        description="Release a class's reports to parents, or write the head remark that goes on every card."
        actions={
          <button
            type="button"
            onClick={refetch}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink className="h-4 w-4" /> Refresh
          </button>
        }
      />

      <Card padding="p-0" className="shadow-none">
        {loading ? (
          <SkeletonRow />
        ) : error ? (
          <p className="p-4 text-sm text-red-600">{error.message || 'The class list could not be loaded.'}</p>
        ) : !items.length ? (
          <EmptyState
            icon={FileText}
            title="No report cards to manage"
            description="Report cards are created and compiled for each class, then released from here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2.5">Class</th>
                  <th className="px-4 py-2.5">Students</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((c) => (
                  <tr key={c.className}>
                    <td className="px-4 py-2.5 font-extrabold text-ink">{c.className}</td>
                    <td className="px-4 py-2.5">{formatCount(c.studentCount || 0)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setOpenRow(c)}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-extrabold text-brand-800 hover:bg-brand-50"
                      >
                        Release reports
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ReleaseModal
        open={!!openRow}
        row={openRow}
        onClose={() => setOpenRow(null)}
        onDone={refetch}
      />
    </>
  );
};

export default ReportCards;
