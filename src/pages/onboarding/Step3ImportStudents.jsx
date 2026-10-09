import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CircleAlert,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Trash2,
  UploadCloud,
  UserPlus,
  Users,
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import { Field, FormAlert, SelectField } from '../../components/common/FormField';
import useOnboardingProgress from '../../hooks/useOnboardingProgress';
import useToast from '../../hooks/useToast';
import { bulkImport, createStudent } from '../../services/students';
import { useAuth } from '../../context/AuthContext';
import { STUDENT_IMPORT_COLUMNS, ROUTES } from '../../utils/constants';
import { useStepChrome } from './OnboardingStepContext';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // matches the backend's multer limit
const PREVIEW_ROWS = 5;
const MANUAL_ENTRY_LIMIT = 20;
const GHANA_PHONE = /^(0[2-5]\d{8}|233[2-5]\d{8})$/;

const currentYear = new Date().getFullYear();
const DEFAULT_ACADEMIC_YEAR = `${currentYear - 1}/${currentYear}`;
const DEFAULT_DEADLINE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

/** Backend accepts up to 5,000 students per roster upload. */
const MAX_ROSTER = 5000;

const EMPTY_MANUAL = {
  studentName: '',
  studentClass: '',
  gender: '',
  parentName: '',
  parentPhone: '',
  totalOwed: '',
  deadline: DEFAULT_DEADLINE,
};

const header = (title, description) => (
  <header className="mb-7">
    <p className="text-[11px] font-extrabold uppercase tracking-wider text-brand-700">Step 3 of 4</p>
    <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
    <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">{description}</p>
  </header>
);

/**
 * Mirrors the header handling in the backend importer: every header is
 * lower-cased and stripped of non-alphanumerics, so `Student Name`,
 * `student name` and `studentname` all address the same column.
 */
const normaliseKeys = (row) =>
  Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [
      String(key).toLowerCase().replace(/[^a-z0-9]/g, ''),
      value,
    ])
  );

/** Client-side mirror of the backend's per-row admission rules. */
const checkRow = (raw) => {
  const row = normaliseKeys(raw);
  const problems = [];
  if (!String(row.studentname || '').trim()) problems.push('Student Name is required');
  if (!String(row.studentclass || '').trim()) problems.push('Student Class is required');
  if (row.gender && !['male', 'female'].includes(String(row.gender).toLowerCase())) {
    problems.push('Gender must be male or female');
  }
  if (!String(row.parentname || '').trim()) problems.push('Parent Name is required');
  const phone = String(row.parentphone || '').replace(/[\s-]/g, '');
  if (!phone) problems.push('Parent Phone is required');
  else if (!GHANA_PHONE.test(phone)) problems.push('Parent Phone is not a valid Ghana number');
  return problems;
};

/**
 * Parse the chosen file in the browser so the admin sees exactly what will be
 * imported before anything is sent. `papaparse` and `xlsx` are loaded
 * dynamically — neither is needed on the initial bundle, and `xlsx` is large.
 */
const parseFile = async (file) => {
  const extension = file.name.split('.').pop().toLowerCase();

  if (extension === 'xlsx' || extension === 'xls') {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { rows: [], headers: [] };
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, defval: '' });
    return { rows, headers: rows[0] ? Object.keys(rows[0]) : [] };
  }

  const Papa = await import('papaparse');
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) =>
        resolve({
          rows: results.data || [],
          headers: results.meta?.fields || [],
          parseErrors: results.errors || [],
        }),
      error: () => resolve({ rows: [], headers: [], parseErrors: [{ message: 'Could not read file' }] }),
    });
  });
};

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const downloadTemplate = () => {
  const header = STUDENT_IMPORT_COLUMNS.map((c) => c.label).join(',');
  const sample = [
    'Ama Serwaa Mensah',
    'JHS 2A',
    'female',
    '2013-04-17',
    'Mr. Kojo Mensah',
    '0241234567',
    'mensah@example.com',
    'Father',
    '1200',
    DEFAULT_DEADLINE,
  ].join(',');

  const blob = new Blob([`${header}\n${sample}\n`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sukuupay-student-import-template.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick: revoking synchronously can cancel the download
  // in some browsers before it has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const ManualStudentModal = ({ open, onClose, onSave, saving }) => {
  const [form, setForm] = useState(EMPTY_MANUAL);
  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (open) {
      setForm(EMPTY_MANUAL);
      setTouched({});
    }
  }, [open]);

  const errors = useMemo(() => {
    const found = {};
    if (form.studentName.trim().length < 2) found.studentName = 'Enter the student name.';
    if (form.studentClass.trim().length < 2) found.studentClass = 'Enter the class.';
    if (!form.gender) found.gender = 'Choose a gender.';
    if (form.parentName.trim().length < 2) found.parentName = 'Enter the parent name.';
    const phone = form.parentPhone.replace(/[\s-]/g, '');
    if (!phone) found.parentPhone = 'Enter the parent phone number.';
    else if (!GHANA_PHONE.test(phone)) found.parentPhone = 'Use a Ghana number, e.g. 0241234567.';
    if (form.totalOwed === '' || Number.isNaN(Number(form.totalOwed)) || Number(form.totalOwed) < 0) {
      found.totalOwed = 'Enter the amount owed in cedis.';
    }
    if (!form.deadline) found.deadline = 'Choose a payment deadline.';
    else if (new Date(form.deadline) < new Date(new Date().toDateString())) {
      found.deadline = 'The deadline cannot be in the past.';
    }
    return found;
  }, [form]);

  const isValid = Object.keys(errors).length === 0;
  const onChange = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  const blur = (key) => () => setTouched((current) => ({ ...current, [key]: true }));
  const showError = (key) => (touched[key] ? errors[key] : undefined);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a student"
      description="Only the primary guardian is required. You can add a second parent later."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!isValid || saving}
            onClick={() => onSave(form)}
            className="flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Add student'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            className="sm:col-span-2"
            label="Student name"
            value={form.studentName}
            onChange={onChange('studentName')}
            onBlur={blur('studentName')}
            error={showError('studentName')}
            required
          />
          <Field
            label="Class"
            placeholder="JHS 2A"
            value={form.studentClass}
            onChange={onChange('studentClass')}
            onBlur={blur('studentClass')}
            error={showError('studentClass')}
            required
          />
          <SelectField
            label="Gender"
            value={form.gender}
            onChange={onChange('gender')}
            onBlur={blur('gender')}
            error={showError('gender')}
            required
          >
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </SelectField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Parent name"
            value={form.parentName}
            onChange={onChange('parentName')}
            onBlur={blur('parentName')}
            error={showError('parentName')}
            required
          />
          <Field
            label="Parent phone"
            type="tel"
            inputMode="tel"
            placeholder="0241234567"
            value={form.parentPhone}
            onChange={onChange('parentPhone')}
            onBlur={blur('parentPhone')}
            error={showError('parentPhone')}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Total owed (GHS)"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="1200"
            value={form.totalOwed}
            onChange={onChange('totalOwed')}
            onBlur={blur('totalOwed')}
            error={showError('totalOwed')}
            required
          />
          <Field
            label="Payment deadline"
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={form.deadline}
            onChange={onChange('deadline')}
            onBlur={blur('deadline')}
            error={showError('deadline')}
            required
          />
        </div>
      </div>
    </Modal>
  );
};

const Step3ImportStudents = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { getStepDraft, setStepDraft } = useOnboardingProgress();
  const { register } = useStepChrome();

  const schoolId = user?.schoolId;

  const [method, setMethod] = useState(null);
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualStudents, setManualStudents] = useState([]);
  const [meta, setMeta] = useState({
    academicYear: DEFAULT_ACADEMIC_YEAR,
    defaultDeadline: DEFAULT_DEADLINE,
    defaultOwed: '',
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const draft = getStepDraft('import-students');
    if (draft) {
      if (draft.method) setMethod(draft.method);
      if (Array.isArray(draft.manualStudents)) setManualStudents(draft.manualStudents);
      if (draft.meta) setMeta((current) => ({ ...current, ...draft.meta }));
      if (draft.result) setResult(draft.result);
    }
    setHydrated(true);
  }, [getStepDraft]);

  useEffect(() => {
    if (!hydrated) return;
    // The File object is not serialisable, so only metadata about the choice is
    // persisted — after a refresh the admin re-picks the file. Nothing the
    // server already accepted is lost.
    setStepDraft('import-students', { method, manualStudents, meta, result });
  }, [method, manualStudents, meta, result, hydrated, setStepDraft]);

  // Import progress is reported by the service on a window event; listening
  // here keeps the service free of any dependency on this component.
  useEffect(() => {
    const onProgress = (event) => setProgress(event.detail);
    window.addEventListener('sukuupay:upload-progress', onProgress);
    return () => window.removeEventListener('sukuupay:upload-progress', onProgress);
  }, []);

  const preview = useMemo(() => {
    if (!parsed?.rows?.length) return null;
    const headers = parsed.headers.length ? parsed.headers : Object.keys(parsed.rows[0]);
    const checks = parsed.rows.map(checkRow);
    return {
      headers,
      rows: parsed.rows.slice(0, PREVIEW_ROWS),
      total: parsed.rows.length,
      valid: checks.filter((problems) => problems.length === 0).length,
      problems: checks.reduce((sum, list) => sum + (list.length ? 1 : 0), 0),
      firstProblemIndex: checks.findIndex((problems) => problems.length > 0),
    };
  }, [parsed]);

  const selectFile = async (selected) => {
    setResult(null);
    setParsed(null);

    if (!selected) return;
    const extension = selected.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(extension)) {
      toast.error('Choose a .csv, .xlsx or .xls file.');
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      toast.error(`That file is ${formatBytes(selected.size)}. The limit is 10 MB.`);
      return;
    }

    setFile(selected);
    setParsing(true);
    try {
      const outcome = await parseFile(selected);
      setParsed(outcome);
      if (!outcome.rows.length) {
        toast.error('No rows were found in that file. Check the header row.');
      } else if (outcome.rows.length > MAX_ROSTER) {
        toast.warning(
          `That file has ${outcome.rows.length} rows. Only the first ${MAX_ROSTER} will be imported.`
        );
      }
    } catch {
      setParsed(null);
      toast.error('That file could not be read. Try re-saving it as CSV.');
    } finally {
      setParsing(false);
    }
  };

  const runImport = async () => {
    if (!file) return;
    setImporting(true);
    setProgress(0);
    try {
      const outcome = await bulkImport(file, {
        schoolId,
        academicYear: meta.academicYear,
        defaultDeadline: meta.defaultDeadline,
        defaultOwed: meta.defaultOwed === '' ? undefined : Number(meta.defaultOwed),
      });
      setResult(outcome);
      if (outcome.failed > 0) {
        toast.warning(
          `Imported ${outcome.created} students. ${outcome.failed} row${outcome.failed === 1 ? '' : 's'} were rejected.`
        );
      } else {
        toast.success(`Imported ${outcome.created} students.`);
      }
    } catch (error) {
      toast.error(error.message || 'The roster could not be imported.');
    } finally {
      setImporting(false);
    }
  };

  const saveManual = async (form) => {
    setManualSaving(true);
    try {
      const created = await createStudent({
        studentName: form.studentName.trim(),
        studentClass: form.studentClass.trim(),
        gender: form.gender,
        // The API stores money in pesewas; the form is in cedis.
        totalOwed: Math.round(Number(form.totalOwed) * 100),
        deadline: form.deadline,
        academicYear: meta.academicYear,
        parents: [
          {
            parentName: form.parentName.trim(),
            relationship: 'guardian',
            phone: form.parentPhone.replace(/[\s-]/g, ''),
            isPrimary: true,
            isAlive: true,
          },
        ],
      });
      setManualStudents((current) => [
        ...current,
        { ...form, id: created?._id || `local_${current.length + 1}` },
      ]);
      setManualOpen(false);
      toast.success(`${form.studentName.trim()} added.`);
    } catch (error) {
      toast.error(error.message || 'That student could not be added.');
    } finally {
      setManualSaving(false);
    }
  };

  const removeManual = (id) =>
    setManualStudents((current) => current.filter((student) => student.id !== id));

  // Continue is always allowed: a school with no roster yet is a valid state,
  // and Step 3 has an explicit "Skip for Now" escape hatch.
  useEffect(() => {
    register({ valid: true, busy: false, label: 'Continue', onSubmit: () => true });
  }, [register]);

  const skip = () => {
    // Step 4 reads this note on mount, so the explanation survives the
    // navigation instead of only flashing as a toast.
    setStepDraft('send-reminder', {
      message: 'You can import students later from the dashboard.',
      at: new Date().toISOString(),
    });
    toast.warning('No students imported. You can do this later from the dashboard.');
    navigate(`${ROUTES.ONBOARDING}/send-reminder`);
  };

  const optionCard = (active) =>
    `rounded-2xl border-2 p-5 text-left transition-all ${
      active ? 'border-brand-600 bg-brand-50/60 shadow-soft' : 'border-slate-200 bg-white hover:border-slate-300'
    }`;

  return (
    <div>
      {header(
        'Bring in your students',
        'Upload your existing roster in one go, or add a handful by hand. You can do this later from the dashboard — nothing here is permanent.'
      )}

      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <button
            type="button"
            aria-pressed={method === 'bulk'}
            onClick={() => setMethod('bulk')}
            className={optionCard(method === 'bulk')}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white">
                <UploadCloud className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-brand-700 ring-1 ring-brand-200">
                Recommended
              </span>
            </div>
            <p className="mt-3.5 text-[15px] font-extrabold tracking-tight text-ink">Bulk upload</p>
            <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-slate-600">
              Upload up to 5,000 students at once via Excel or CSV. Rows that fail validation are
              reported individually, so one typo never blocks the rest.
            </p>
          </button>

          <button
            type="button"
            aria-pressed={method === 'manual'}
            onClick={() => setMethod('manual')}
            className={optionCard(method === 'manual')}
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  method === 'manual' ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <UserPlus className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                Up to {MANUAL_ENTRY_LIMIT} students
              </span>
            </div>
            <p className="mt-3.5 text-[15px] font-extrabold tracking-tight text-ink">Add manually</p>
            <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-slate-600">
              Add students one at a time. Best for small schools — for more than{' '}
              {MANUAL_ENTRY_LIMIT} students, bulk upload is far quicker.
            </p>
          </button>
        </div>

        {method === 'bulk' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[15px] font-extrabold tracking-tight text-ink">Upload your roster</h2>
              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-700 hover:underline"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download CSV Template
              </button>
            </div>

            <label
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
                file ? 'border-brand-300 bg-brand-50/50' : 'border-slate-300 bg-slate-50 hover:border-brand-400'
              }`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-brand-700 shadow-soft">
                {parsing ? (
                  <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden="true" />
                ) : (
                  <UploadCloud className="h-6 w-6" aria-hidden="true" />
                )}
              </span>
              <span className="mt-3 text-sm font-bold text-ink">
                {file ? 'Choose a different file' : 'Choose File'}
              </span>
              <span className="mt-1 text-[12px] font-medium text-slate-500">
                CSV, XLSX or XLS · up to 10 MB
              </span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="sr-only"
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  event.target.value = '';
                  selectFile(selected);
                }}
              />
            </label>

            {file && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                <FileSpreadsheet className="h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-ink">{file.name}</p>
                  <p className="text-[11px] font-semibold text-slate-500">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setParsed(null);
                    setResult(null);
                  }}
                  aria-label={`Remove ${file.name}`}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}

            {preview && (
              <div className="mt-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-700">
                    {preview.total} rows
                  </span>
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-extrabold text-brand-700">
                    {preview.valid} look valid
                  </span>
                  {preview.problems > 0 && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-extrabold text-amber-800">
                      {preview.problems} need attention
                    </span>
                  )}
                </div>

                {preview.problems > 0 && (
                  <div className="mb-3">
                    <FormAlert tone="info">
                      Row {preview.firstProblemIndex + 2} looks wrong:{' '}
                      {checkRow(parsed.rows[preview.firstProblemIndex]).join('; ')}. Rows that fail
                      this check will be reported back after the import rather than silently dropped.
                    </FormAlert>
                  </div>
                )}

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-left text-[12px]">
                    <caption className="sr-only">
                      Preview of the first {PREVIEW_ROWS} rows of {file?.name}
                    </caption>
                    <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                      <tr>
                        {preview.headers.map((column) => (
                          <th key={column} scope="col" className="whitespace-nowrap px-3 py-2.5">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.rows.map((row, index) => {
                        const problems = checkRow(row);
                        return (
                          <tr
                            key={index}
                            className={problems.length ? 'bg-red-50/60 text-red-900' : 'text-slate-700'}
                          >
                            {preview.headers.map((column) => (
                              <td key={column} className="whitespace-nowrap px-3 py-2">
                                {String(row[column] ?? '—')}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] font-semibold text-slate-400">
                  Showing {Math.min(PREVIEW_ROWS, preview.total)} of {preview.total} rows.
                </p>
              </div>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Field
                label="Academic year"
                placeholder="2025/2026"
                value={meta.academicYear}
                onChange={(event) => setMeta((current) => ({ ...current, academicYear: event.target.value }))}
                hint="YYYY/YYYY"
              />
              <Field
                label="Default amount owed (GHS)"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="Uses the file value"
                value={meta.defaultOwed}
                onChange={(event) => setMeta((current) => ({ ...current, defaultOwed: event.target.value }))}
                hint="Optional fallback"
              />
              <Field
                label="Default deadline"
                type="date"
                value={meta.defaultDeadline}
                onChange={(event) => setMeta((current) => ({ ...current, defaultDeadline: event.target.value }))}
                hint="Optional fallback"
              />
            </div>

            {importing && (
              <div className="mt-4">
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Roster upload progress"
                >
                  <div
                    className="h-full rounded-full bg-brand-600 transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-1.5 text-center text-[12px] font-bold text-slate-500" role="status">
                  Uploading roster… {progress}%
                </p>
              </div>
            )}

            {result && (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-extrabold text-brand-700">
                    {result.created} imported
                  </span>
                  {result.failed > 0 && (
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-extrabold text-red-700">
                      {result.failed} rejected
                    </span>
                  )}
                </div>

                {result.errors?.length > 0 && (
                  <div
                    role="alert"
                    className="max-h-48 overflow-y-auto rounded-xl border border-red-200 bg-red-50 p-3"
                  >
                    <p className="mb-2 flex items-center gap-1.5 text-[12px] font-extrabold text-red-800">
                      <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                      Rows that were not imported
                    </p>
                    <ul className="space-y-1">
                      {result.errors.slice(0, 100).map((item, index) => (
                        <li key={index} className="text-[12px] font-medium text-red-700">
                          <span className="font-extrabold">Row {item.row}:</span> {item.reason}
                        </li>
                      ))}
                    </ul>
                    {result.errors.length > 100 && (
                      <p className="mt-2 text-[11px] font-semibold text-red-600">
                        Showing the first 100 of {result.errors.length} rejected rows.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {file && (
              <div className="mt-5">
                <button
                  type="button"
                  onClick={runImport}
                  disabled={importing || parsing || !preview?.total}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 py-3 text-sm font-bold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {importing ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <UploadCloud className="h-4 w-4" aria-hidden="true" />
                  )}
                  {importing
                    ? 'Importing…'
                    : `Import ${preview?.total ?? 0} student${preview?.total === 1 ? '' : 's'}`}
                </button>
              </div>
            )}
          </section>
        )}

        {method === 'manual' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-extrabold tracking-tight text-ink">
                  Students added ({manualStudents.length})
                </h2>
                {manualStudents.length >= MANUAL_ENTRY_LIMIT && (
                  <p className="mt-1 text-[12px] font-semibold text-amber-700">
                    You have reached {MANUAL_ENTRY_LIMIT}. Bulk upload is much faster beyond this.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setManualOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Add One Student
              </button>
            </div>

            {manualStudents.length === 0 ? (
              <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-slate-200 px-6 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  <Users className="h-6 w-6" aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-bold text-ink">No students added yet</p>
                <p className="mt-1 max-w-sm text-[12px] font-medium text-slate-500">
                  Add your first student, or switch to bulk upload if your roster is more than a
                  handful of names.
                </p>
                <button
                  type="button"
                  onClick={() => setMethod('bulk')}
                  className="mt-4 text-[12px] font-bold text-brand-700 hover:underline"
                >
                  Switch to bulk upload
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                {manualStudents.map((student) => (
                  <li key={student.id} className="flex items-center gap-3 px-3.5 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[12px] font-extrabold text-brand-700">
                      {student.studentName.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-ink">{student.studentName}</p>
                      <p className="truncate text-[11px] font-semibold text-slate-500">
                        {student.studentClass} · {student.parentName} · {student.parentPhone}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeManual(student.id)}
                      aria-label={`Remove ${student.studentName}`}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <div className="text-center">
          <button type="button" onClick={skip} className="text-[13px] font-bold text-slate-500 hover:text-brand-700 hover:underline">
            Skip for Now
          </button>
          <p className="mt-1 text-[12px] font-medium text-slate-400">
            You can import students any time from the dashboard.
          </p>
        </div>
      </div>

      <ManualStudentModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onSave={saveManual}
        saving={manualSaving}
      />
    </div>
  );
};

export default Step3ImportStudents;
