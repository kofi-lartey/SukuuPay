import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, Download, Filter, Loader2, Search, Share2 } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import { createIdCardBatch, listBatches, mergeIdCardBatches } from '../../services/idCards';
import { fetchIdCardTemplates } from '../../services/idCardTemplates';

/**
 * Bulk ID Card Printing.
 *
 * Lets an admin select students via multiple filters and generate a custom
 * batch. Also supports merging existing batches into a combined print run.
 */
const IdCardBulkPrint = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { success, error: errorToast, warning } = useToast();

  const schoolId = user?.schoolId;

  // Filter state
  const [classFilter, setClassFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState([]);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [hasPayLink, setHasPayLink] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Data state
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [mergeSources, setMergeSources] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [batchStatus, setBatchStatus] = useState(null);
  const [pollRef, setPollRef] = useState(null);
  const [showMergeModal, setShowMergeModal] = useState(false);

  const cardsPerSheet = 6;

  // Load school classes, templates, and batches
  const loadInitialData = useCallback(async () => {
    if (!schoolId) return;

    setLoading(true);
    try {
      // Fetch school classes
      const schoolRes = await fetch(`/api/schools/${schoolId}`, {
        headers: { Authorization: `Bearer ${user?.token || ''}` },
      });
      if (schoolRes.ok) {
        const schoolData = await schoolRes.json();
        setClasses(schoolData.data?.academic?.classes || []);
      }

      // Fetch templates
      const templateList = await fetchIdCardTemplates(schoolId);
      setTemplates(templateList);

      // Fetch recent batches
      const batchList = await listBatches(schoolId, { page: 1, perPage: 10 });
      setBatches(batchList.batches || []);
    } catch (err) {
      errorToast('Failed to load initial data');
    } finally {
      setLoading(false);
    }
  }, [schoolId, user?.token, errorToast]);

  // Fetch students via the students API
  const loadStudents = useCallback(async () => {
    if (!schoolId) return;

    try {
      const params = new URLSearchParams();
      if (classFilter.length > 0) params.set('class', classFilter.join(','));
      if (genderFilter.length > 0) params.set('gender', genderFilter.join(','));
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      params.set('page', '1');
      params.set('perPage', '200');

      const res = await fetch(`/api/students?${params.toString()}`, {
        headers: { Authorization: `Bearer ${user?.token || ''}` },
      });

      if (res.ok) {
        const data = await res.json();
        setStudents(data.data || []);
      }
    } catch (err) {
      errorToast('Failed to load students');
    }
  }, [schoolId, classFilter, genderFilter, searchTerm, user?.token, errorToast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // Apply client-side filters
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      if (statusFilter === 'active' && student.status !== 'active') return false;
      if (statusFilter === 'owed' && student.totalOwed <= 0) return false;
      if (statusFilter === 'paid' && student.totalOwed === 0) return false;
      if (hasPhoto && !student.studentImage) return false;
      if (hasPayLink && !student.payLink) return false;
      return true;
    });
  }, [students, statusFilter, hasPhoto, hasPayLink]);

  const selectedCount = selectedStudents.size;
  const sheetsNeeded = Math.ceil(selectedCount / cardsPerSheet);
  const pagesEstimated = sheetsNeeded * 2;

  const toggleSelection = (id) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map((s) => s._id)));
    }
  };

  const handleGenerate = async () => {
    if (selectedStudents.size === 0) {
      warning('Select at least one student to print.');
      return;
    }

    setGenerating(true);
    setBatchStatus({ status: 'starting' });

    try {
      const result = await createIdCardBatch(
        Array.from(selectedStudents),
        {
          useSchoolSettings: !selectedTemplate,
          templateId: selectedTemplate,
        }
      );

      setBatchStatus({ status: 'pending', batchId: result.batchId });

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/id-cards/batch/${result.batchId}/status`, {
            headers: { Authorization: `Bearer ${user?.token || ''}` },
          });
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.data?.status === 'ready') {
              clearInterval(pollInterval);
              success('Batch generated successfully!');
              navigate(`/id-cards/batch/${result.batchId}/print`);
            } else if (statusData.data?.status === 'failed') {
              clearInterval(pollInterval);
              setBatchStatus({ status: 'failed', error: statusData.data?.generationError });
              errorToast('Batch generation failed');
            }
          }
        } catch (err) {
          // Continue polling
        }
      }, 3000);

      setPollRef(pollInterval);
    } catch (err) {
      errorToast(err.message || 'Failed to create batch');
      setBatchStatus({ status: 'failed' });
    } finally {
      setGenerating(false);
    }
  };

  const handleMerge = async () => {
    if (mergeSources.length === 0) {
      warning('Select at least two batches to merge.');
      return;
    }

    setGenerating(true);
    setShowMergeModal(false);

    try {
      const result = await mergeIdCardBatches(mergeSources);
      setBatchStatus({ status: 'pending', batchId: result.batchId });

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/id-cards/batch/${result.batchId}/status`, {
            headers: { Authorization: `Bearer ${user?.token || ''}` },
          });
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.data?.status === 'ready') {
              clearInterval(pollInterval);
              success('Merged batch generated successfully!');
              navigate(`/id-cards/batch/${result.batchId}/print`);
            } else if (statusData.data?.status === 'failed') {
              clearInterval(pollInterval);
              setBatchStatus({ status: 'failed', error: statusData.data?.generationError });
              errorToast('Batch generation failed');
            }
          }
        } catch (err) {
          // Continue polling
        }
      }, 3000);

      setPollRef(pollInterval);
    } catch (err) {
      errorToast(err.message || 'Failed to merge batches');
      setBatchStatus({ status: 'failed' });
    } finally {
      setGenerating(false);
    }
  };

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef) clearInterval(pollRef);
    };
  }, [pollRef]);

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Top bar */}
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-ink">Bulk ID Card Printing</h1>

          <button
            onClick={handleGenerate}
            disabled={generating || selectedStudents.size === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Generate Batch
              </>
            )}
          </button>
        </div>

        {/* Filter panel */}
        <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-4">
          {/* Class filter */}
          <div>
            <label className="mb-1.5 block text-sm font-extrabold text-slate-600">
              Class
            </label>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
              {classes.map((cls) => (
                <label
                  key={cls}
                  className="flex items-center gap-2 rounded-lg p-1.5 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={classFilter.includes(cls)}
                    onChange={(e) => {
                      const next = new Set(classFilter);
                      if (e.target.checked) next.add(cls);
                      else next.delete(cls);
                      setClassFilter(Array.from(next));
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
                  />
                  {cls}
                </label>
              ))}
            </div>
          </div>

          {/* Status filter */}
          <div>
            <label className="mb-1.5 block text-sm font-extrabold text-slate-600">
              Status
            </label>
            <div className="space-y-1">
              {['all', 'active', 'owed', 'paid'].map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="status"
                    value={option}
                    checked={statusFilter === option}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-4 w-4 text-brand-700 focus:ring-brand-700/30"
                  />
                  <span className="capitalize">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Gender filter */}
          <div>
            <label className="mb-1.5 block text-sm font-extrabold text-slate-600">
              Gender
            </label>
            <div className="space-y-1">
              {['Male', 'Female'].map((gender) => (
                <label key={gender} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={genderFilter.includes(gender)}
                    onChange={(e) => {
                      const next = new Set(genderFilter);
                      if (e.target.checked) next.add(gender);
                      else next.delete(gender);
                      setGenderFilter(Array.from(next));
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
                  />
                  {gender}
                </label>
              ))}
            </div>
          </div>

          {/* Additional filters */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hasPhoto}
                onChange={(e) => setHasPhoto(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
              />
              <label className="text-sm font-medium text-slate-700">
                Has photo
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hasPayLink}
                onChange={(e) => setHasPayLink(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
              />
              <label className="text-sm font-medium text-slate-700">
                Has pay link
              </label>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-extrabold text-slate-600">
                Template
              </label>
              <select
                value={selectedTemplate || ''}
                onChange={(e) => setSelectedTemplate(e.target.value || null)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              >
                <option value="">Use school default settings</option>
                {templates.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} ({t.audience})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-extrabold text-slate-600">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Name or Student ID…"
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-ink placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Merge section */}
        <div className="mb-5">
          <button
            onClick={() => setShowMergeModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Share2 className="h-4 w-4" />
            Merge existing batches
          </button>
          <span className="ml-3 text-sm text-slate-500">
            Combine multiple previously generated batches into one print run.
          </span>
        </div>

        {/* Student grid */}
        <div className="mb-5 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-extrabold text-slate-600">
              <input
                type="checkbox"
                checked={
                  filteredStudents.length > 0 &&
                  filteredStudents.every((s) => selectedStudents.has(s._id))
                }
                onChange={handleSelectAll}
                className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
              />
              Select all ({filteredStudents.length} shown)
            </label>
            <p className="text-sm text-slate-500">
              {selectedCount} of {filteredStudents.length} selected
            </p>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-slate-200" />
              ))}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              No students match your filters.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredStudents.map((student) => {
                const id = student._id;
                const isSelected = selectedStudents.has(id);

                return (
                  <div
                    key={id}
                    className={`flex items-center gap-3 p-3 transition-colors ${
                      isSelected ? 'bg-brand-50/30' : 'hover:bg-slate-50'
                    }}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(id)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
                    />

                    {student.studentImage ? (
                      <img
                        src={student.studentImage}
                        alt={student.studentName}
                        className="h-8 w-8 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 text-[6px] font-bold text-slate-400">
                        NO PHOTO
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-ink">
                        {student.studentName}
                      </p>
                      <p className="text-xs font-medium text-slate-500">
                        {student.studentId} · {student.studentClass}
                      </p>
                    </div>

                    <div className="text-right text-xs">
                      <span className="font-medium text-slate-500">
                        {student.academicYear || '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer bar */}
        <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-600">
            <span className="font-extrabold">{selectedCount}</span> students selected ·{' '}
            <span className="font-extrabold">{sheetsNeeded}</span> sheets ·{' '}
            <span className="font-extrabold">{pagesEstimated}</span> pages
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => setShowMergeModal(true)}
              disabled={batches.length === 0}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
            >
              Preview Merge
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || selectedStudents.size === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Generate Batch
            </button>
          </div>
        </div>

        {/* Batch status indicator */}
        {batchStatus?.status === 'pending' && (
          <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm">
            <span className="font-extrabold text-amber-800">Generating print file…</span>
            <p className="mt-1 text-slate-600">
              This may take a few moments. You will be redirected to the print preview
              when ready.
            </p>
          </div>
        )}

        {batchStatus?.status === 'failed' && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm">
            <span className="font-extrabold text-red-800">Batch generation failed</span>
            <p className="mt-1 text-slate-600">{batchStatus.error}</p>
          </div>
        )}
      </div>

      {/* Merge modal */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-extrabold text-ink">Merge Existing Batches</h3>
            <p className="mb-4 text-sm text-slate-600">
              Select batches to combine into a single print run. Students are
              deduplicated by student ID.
            </p>

            <div className="max-h-48 space-y-2 overflow-y-auto">
              {batches.map((batch) => (
                <label
                  key={batch._id}
                  className="flex items-start gap-3 rounded-lg border border-slate-200 p-2 cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={mergeSources.includes(batch._id)}
                    onChange={(e) => {
                      const next = new Set(mergeSources);
                      if (e.target.checked) next.add(batch._id);
                      else next.delete(batch._id);
                      setMergeSources(Array.from(next));
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
                  />
                  <div className="text-sm">
                    <p className="font-extrabold text-ink">
                      {batch.totalCards} cards
                    </p>
                    <p className="text-slate-500">
                      Created {new Date(batch.createdAt).toLocaleDateString()} ·{' '}
                      {batch.cardsPerSheet} per sheet
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setShowMergeModal(false)}
                className="px-4 py-2 text-sm font-extrabold text-slate-600 hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={handleMerge}
                disabled={mergeSources.length === 0 || generating}
                className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-brand-800 disabled:opacity-50"
              >
                {generating ? 'Merging…' : 'Generate Combined Print'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IdCardBulkPrint;
