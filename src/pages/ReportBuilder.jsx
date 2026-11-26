import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../hooks/useEntitlements';
import { useTemplates, useCreateTemplate, useJobs, useCreateJob, useJob } from '../hooks/useReportsBuilder';
import ExportPreview from '../components/reports/ExportPreview';
import MoEExport from '../components/reports/MoEExport';
import Modal from '../components/common/Modal';
import { FileText, Download, Clock } from 'lucide-react';

const TEMPLATE_TYPES = [
  { key: 'moe_compliance', name: 'MoE Compliance Export', format: 'csv' },
  { key: 'custom_audit', name: 'Custom Audit Report', format: 'pdf' },
  { key: 'financial_summary', name: 'Financial Summary', format: 'xlsx' },
];

export default function ReportBuilder() {
  const { user } = useAuth();
  const ent = useEntitlements();
  const schoolId = user?.schoolId;

  if (ent.currentTier !== 'growth') {
    return <div className="p-6">Growth plan required.</div>;
  }

  const { data: templates = [], isLoading: loadingTemplates } = useTemplates({ schoolId });
  const { data: jobs = [], isLoading: loadingJobs } = useJobs({ schoolId });
  const createTemplate = useCreateTemplate();
  const createJob = useCreateJob();

  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [newType, setNewType] = useState('moe_compliance');

  const handleCreateTemplate = () => {
    const t = TEMPLATE_TYPES.find((x) => x.key === newType);
    createTemplate.mutate(
      { schoolId, name: t.name, type: newType, format: t.format, moeCompliant: newType === 'moe_compliance' },
      { onSuccess: () => setOpen(false) }
    );
  };

  const handleCreateJob = (templateId, params) => {
    createJob.mutate({ templateId, schoolId, parameters: params }, { onSuccess: (res) => setJobId(res?._id || res?.job?._id) });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Custom Audit Reports</h1>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
          onClick={() => { setNewType('moe_compliance'); setOpen(true); }}
        >
          <FileText className="w-4 h-4" /> New Report
        </button>
      </div>

      {loadingTemplates || loadingJobs ? (
        <p>Loading reports...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map((t) => (
              <div key={t._id} className="border border-slate-100 rounded-lg p-4">
                <h3 className="font-semibold text-slate-800">{t.name}</h3>
                <p className="text-xs text-slate-500 mb-3">{t.type} • {t.format.toUpperCase()}</p>
                <button
                  onClick={() => handleCreateJob(t._id, { term: 'Term 1', year: '2026' })}
                  className="w-full bg-blue-600 text-white py-2 rounded text-sm disabled:opacity-50"
                  disabled={createJob.isPending}
                >
                  {createJob.isPending ? 'Queuing...' : 'Export'}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <h2 className="text-lg font-bold text-slate-800 mb-3">Export Jobs</h2>
            <div className="space-y-2">
              {jobs.map((j) => (
                <div key={j._id} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-800">Job {j._id.slice(-6)}</p>
                    <p className="text-xs text-slate-500">{j.status}</p>
                  </div>
                  {j.status === 'completed' && j.fileUrl ? (
                    <button
                      onClick={() => window.open(j.fileUrl, '_blank')}
                      className="flex items-center gap-2 text-blue-600 text-sm underline"
                    >
                      <Download className="w-4 h-4" /> Download
                    </button>
                  ) : j.status === 'failed' ? (
                    <span className="text-xs text-red-600">Failed: {j.errorMessage || 'Unknown error'}</span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="w-3 h-3" animate-spin /> Processing
                    </span>
                  )}
                </div>
              ))}
              {jobs.length === 0 && <p className="text-sm text-slate-400">No export jobs yet.</p>}
            </div>
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Create Report Template">
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-700 block">Template type</label>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="w-full p-2 border border-slate-200 rounded"
          >
            {TEMPLATE_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            MoE compliance exports use a fixed Ghana Ministry of Education column
            mapping: EMIS code, student name, class, term, academic year, fees
            assessed, fees paid, balance, payment date, receipt number, audit
            actor, timestamp.
          </p>
          <button
            onClick={handleCreateTemplate}
            disabled={createTemplate.isPending}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            {createTemplate.isPending ? 'Creating...' : 'Create Template'}
          </button>
        </div>
      </Modal>

      {jobId && (
        <JobStatusModal
          id={jobId}
          open={Boolean(jobId)}
          onClose={() => setJobId(null)}
        />
      )}
    </div>
  );
}

function JobStatusModal({ id, open, onClose }) {
  const { data: job, isLoading } = useJob(id);

  if (!open || !job) return null;

  return (
    <Modal open={open} onClose={onClose} title="Export Job Status" size="md">
      <div className="space-y-4">
        <div className="bg-slate-50 p-3 rounded-lg">
          <p className="text-xs text-slate-500">Status</p>
          <p className="font-medium">{job.status}</p>
        </div>
        {job.status === 'completed' && job.fileUrl ? (
          <button
            onClick={() => window.open(job.fileUrl, '_blank')}
            className="w-full bg-blue-600 text-white py-2 rounded flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Download Export
          </button>
        ) : job.status === 'failed' ? (
          <p className="text-sm text-red-600">Export failed: {job.errorMessage || 'Unknown error'}</p>
        ) : null}
      </div>
    </Modal>
  );
}
