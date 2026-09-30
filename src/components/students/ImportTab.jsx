import React, { useState } from 'react';
import { CircleCheck, Download, FileSpreadsheet, TriangleAlert, UploadCloud } from 'lucide-react';
import Card from '../dashboard/ui/Card';
import Button from '../common/Button';
import { Field, FormAlert, SelectField } from '../common/FormField';
import { bulkImport, validateImport } from '../../services/students';
import useToast from '../../hooks/useToast';
import { STUDENT_IMPORT_COLUMNS } from '../../utils/constants';
import { formatCount } from '../../utils/format';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // matches the backend's multer limit

/**
 * Bulk roster import.
 *
 * **Always validates before committing.** The dry run is the same endpoint and
 * the same code path as the real import, so the preview cannot disagree with what
 * happens next — the failure mode of a client-side preview that re-implements
 * the server's rules is a mismatch, and then nobody trusts either one.
 *
 * **The money unit is stated, because it is the thing people get wrong.** The CSV
 * column is in *cedis* — a spreadsheet a bursar fills in says `850` — while every
 * other field in this app is in pesewas. The importer converts at the file
 * boundary, and the hint under the default-fee field says so, because a default
 * of `850` sent as pesewas would be GH₵ 8.50 per child.
 */
const ImportTab = ({ school, onImported }) => {
  const { success, error: errorToast, warning } = useToast();

  const [file, setFile] = useState(null);
  const [academicYear, setAcademicYear] = useState('');
  const [defaultDeadline, setDefaultDeadline] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [defaultOwed, setDefaultOwed] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const onFile = (chosen) => {
    setResult(null);
    setPreview(null);
    if (!chosen) {
      setFile(null);
      return;
    }
    if (chosen.size > MAX_FILE_BYTES) {
      errorToast(`That file is ${(chosen.size / 1024 / 1024).toFixed(1)}MB. The limit is 10MB.`);
      return;
    }
    setFile(chosen);
  };

  const meta = () => ({
    schoolId: school?.schoolId || school?._id,
    academicYear: academicYear || undefined,
    defaultDeadline: defaultDeadline || undefined,
    // Cedis. The importer multiplies by 100.
    defaultOwed: defaultOwed === '' ? undefined : Number(defaultOwed),
  });

  const runValidation = async () => {
    if (!file) {
      errorToast('Choose a file first.');
      return;
    }
    setBusy(true);
    try {
      const data = await validateImport(file, meta());
      setPreview(data);
      if (data.failed) {
        warning(`${formatCount(data.failed)} of ${formatCount(data.total)} rows need attention before this can be imported.`);
      }
    } catch (err) {
      errorToast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);
    try {
      const data = await bulkImport(file, meta());
      setResult(data);
      setPreview(null);
      if (data.created > 0) {
        success(`${formatCount(data.created)} students imported.`);
        if (data.failed === 0) onImported?.();
      } else {
        warning('Nothing was imported. Check the failures below.');
      }
    } catch (err) {
      // A 4xx here still carries a per-row report: the server returns
      // `{ created, failed, errors }` with a 400 when every row failed, and
      // losing that is losing the only useful part of the response.
      const details = err?.details;
      if (details?.errors?.length) {
        setResult(details);
        errorToast(err.message);
      } else {
        errorToast(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    // The header is written in full because the importer accepts any header and
    // matches on a normalised form, and a template that does not name the money
    // unit is how a school imports 100× too little.
    const header = [
      'Student Name',
      'Class',
      'Gender',
      'Parent Name',
      'Parent Phone',
      'Total Owed (CEDIS)',
      'Deadline',
      'Date of Birth',
      'Parent Relationship',
      'Parent Email',
    ];
    const sample = [
      'Kwame Mensah',
      school?.academic?.classes?.[0] || 'JHS 1',
      'male',
      'Ama Mensah',
      '0241234567',
      '850',
      defaultDeadline || '2026-03-31',
      '2014-06-02',
      'mother',
      'ama@example.com',
    ];

    const csv = `Student Name,Class,Gender,Parent Name,Parent Phone,Total Owed (CEDIS),Deadline,Date of Birth,Parent Relationship,Parent Email\n${sample.join(
      ','
    )}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'student-import-template.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const report = preview || result;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card padding="p-5">
          <h3 className="text-base font-extrabold text-ink">Upload a roster</h3>
          <p className="mt-1 text-[13px] font-medium text-slate-500">
            CSV or Excel, up to 5,000 students per file. Columns are matched loosely, so
            &ldquo;Student Name&rdquo;, &ldquo;student name&rdquo; and &ldquo;studentname&rdquo; all work.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Academic year"
              hint="optional"
              placeholder="2025/2026"
              value={academicYear}
              onChange={(event) => setAcademicYear(event.target.value)}
            />
            <Field
              label="Default deadline"
              type="date"
              hint="used when a row has none"
              min={new Date().toISOString().slice(0, 10)}
              value={defaultDeadline}
              onChange={(event) => setDefaultDeadline(event.target.value)}
            />
            <Field
              label="Default fee"
              hint="in cedis, not pesewas"
              inputMode="decimal"
              placeholder="850.00"
              value={defaultOwed}
              onChange={(event) => setDefaultOwed(event.target.value)}
              className="sm:col-span-2"
            />
          </div>

          <label
            htmlFor="roster-file"
            className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/40"
          >
            <UploadCloud className="h-8 w-8 text-slate-400" aria-hidden="true" />
            <span className="mt-2 text-sm font-extrabold text-ink">
              {file ? file.name : 'Choose a file'}
            </span>
            <span className="mt-0.5 text-[12px] font-semibold text-slate-500">
              {file ? `${(file.size / 1024).toFixed(0)}KB` : 'or drop one here'}
            </span>
            <input
              id="roster-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(event) => onFile(event.target.files?.[0])}
              className="sr-only"
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={runValidation} disabled={!file || busy}>
              {busy ? 'Checking…' : 'Check the file'}
            </Button>
            <Button
              variant="secondary"
              onClick={commit}
              disabled={!file || busy || (preview && preview.valid === 0)}
            >
              Import {preview ? `${formatCount(preview.valid)} students` : 'anyway'}
            </Button>
            <Button variant="ghost" onClick={downloadTemplate}>
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Download template
            </Button>
          </div>

          {/* The money unit, stated where it is set rather than in a help page. */}
          <FormAlert tone="warning">
            <TriangleAlert className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
            The <span className="font-extrabold">Total Owed</span> column is in{' '}
            <span className="font-extrabold">cedis</span> — 850 means GH₵ 850.00. The API
            itself uses pesewas everywhere else, so this column is the one place the
            two differ, and it is converted when the file is read.
          </FormAlert>
        </Card>
      </div>

      <div className="lg:col-span-1">
        {report ? (
          <Card padding="p-5">
            <h3 className="text-base font-extrabold text-ink">
              {result ? 'Import result' : 'Validation report'}
            </h3>

            <div className="mt-3 space-y-2">
              {result && (
                <Stat
                  tone={result.created > 0 ? 'green' : 'slate'}
                  label="Imported"
                  value={formatCount(result.created || 0)}
                  icon={CircleCheck}
                />
              )}
              {preview && !result && (
                <Stat
                  tone="green"
                  label="Ready to import"
                  value={formatCount(preview.valid || 0)}
                  icon={CircleCheck}
                />
              )}
              <Stat
                tone={report.failed > 0 ? 'red' : 'slate'}
                label={report.failed > 0 ? 'Need attention' : 'No failures'}
                value={formatCount(report.failed || 0)}
                icon={report.failed > 0 ? TriangleAlert : CircleCheck}
              />
            </div>

            {report.errors?.length > 0 && (
              <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                {report.errors.slice(0, 100).map((rowError, index) => (
                  <li
                    key={`${rowError.row}-${index}`}
                    className="rounded-lg bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700"
                  >
                    {rowError.row ? <span className="font-extrabold">Row {rowError.row}: </span> : null}
                    {rowError.reason}
                  </li>
                ))}
              </ul>
            )}

            {report.errors?.length > 100 && (
              <p className="mt-2 text-[11px] font-semibold text-slate-500">
                Showing the first 100 of {formatCount(report.errors.length)} failures.
              </p>
            )}
          </Card>
        ) : (
          <Card padding="p-5">
            <h3 className="flex items-center gap-2 text-base font-extrabold text-ink">
              <FileSpreadsheet className="h-4 w-4 text-slate-400" aria-hidden="true" />
              Columns
            </h3>
            <p className="mt-1 text-[12px] font-semibold text-slate-500">
              Only the first five are required. The rest are optional.
            </p>
            <ul className="mt-3 space-y-1.5">
              {STUDENT_IMPORT_COLUMNS.map((column) => (
                <li key={column.key} className="flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="font-extrabold text-ink">{column.label}</span>
                  <span className="text-right font-semibold text-slate-500">
                    {column.required ? 'required' : 'optional'}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
};

const Stat = ({ label, value, tone, icon: Icon }) => (
  <div
    className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${
      tone === 'green'
        ? 'bg-emerald-50'
        : tone === 'red'
          ? 'bg-red-50'
          : 'bg-slate-50'
    }`}
  >
    <span className="flex items-center gap-2 text-[13px] font-bold text-slate-600">
      <Icon
        className={`h-4 w-4 ${
          tone === 'green' ? 'text-emerald-600' : tone === 'red' ? 'text-red-600' : 'text-slate-400'
        }`}
        aria-hidden="true"
      />
      {label}
    </span>
    <span className="text-[15px] font-extrabold tabular-nums text-ink">{value}</span>
  </div>
);

export default ImportTab;
