import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, UserPlus } from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import ModuleTabs from '../../components/dashboard/ModuleTabs';
import RosterKpiRow from '../../components/students/RosterKpiRow';
import RosterFilterBar from '../../components/students/RosterFilterBar';
import StudentTable from '../../components/students/StudentTable';
import BulkActionBar from '../../components/students/BulkActionBar';
import StudentProfileDrawer from '../../components/students/StudentProfileDrawer';
import StudentForm from '../../components/students/StudentForm';
import ImportTab from '../../components/students/ImportTab';
import AlumniTab from '../../components/students/AlumniTab';
import useToast from '../../hooks/useToast';
import { useStudents, useStudentStats, useRosterSelection } from '../../hooks/useStudents';
import { useAuth } from '../../context/AuthContext';
import { getSchool } from '../../services/school';
import {
  bulkArchiveStudents,
  bulkRegeneratePayLinks,
  bulkSetStatus,
  bulkUpdateStudents,
  exportStudents,
  regeneratePayLink,
} from '../../services/students';
import { ROUTES } from '../../utils/constants';
import { formatCount } from '../../utils/format';

const TABS = [
  { value: 'roster', label: 'Roster' },
  { value: 'import', label: 'Import' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'cohorts', label: 'Cohorts' },
];

/**
 * The Students module.
 *
 * The route owns the shell-level concerns — the tab, the school, the toast and
 * the mutation plumbing — and delegates the screen to a tab component. The
 * mutation handlers live here rather than in the table because they are shared:
 * the row actions, the bulk action bar and the profile drawer all invalidate the
 * same list, and three components each holding their own copy of "reload the
 * roster" is how they drift.
 */
const Students = () => {
  const { user } = useAuth();
  const { success, warning, error: errorToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'roster';

  const [school, setSchool] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileId, setProfileId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const { rows, meta, loading, error, filters, setFilter, clearFilters, hasFilters } =
    useStudents(reloadKey);
  const { stats, loading: statsLoading } = useStudentStats(filters);
  const selection = useRosterSelection(rows, filters);

  useEffect(() => {
    if (!user?.schoolId) return;
    let active = true;
    getSchool(user.schoolId)
      .then((result) => {
        if (active) setSchool(result);
      })
      .catch(() => {
        // The class list comes from the school record. Without it the class
        // filter is empty, which is visible rather than fatal.
        if (active) setSchool(null);
      });
    return () => {
      active = false;
    };
  }, [user?.schoolId]);

  const classes = useMemo(
    () => school?.academic?.classes || school?.classes || [],
    [school]
  );

  /** The single invalidation point every mutation funnels through. */
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const setTab = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'roster') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  // ── Mutations ──
  // Each returns its result so the caller can close its dialog, and surfaces a
  // toast so a failure is never silent. `reloadKey` is a dependency of
  // `useStudents`' effect through the filters object, so bumping it re-runs the
  // list and the stats together.

  const onExport = async () => {
    try {
      const { filename } = await exportStudents(filters);
      success(`Downloaded ${filename}`);
    } catch (err) {
      errorToast(err.message);
    }
  };

  const onMessage = (student) => {
    // Honest about state: there is no school-facing send endpoint yet, so this
    // routes to the module that owns reminders rather than pretending.
    warning(
      `Reminders for ${student.studentName} are sent from the SMS Reminders module — the send API is not wired yet.`
    );
    setSearchParams({ tab: 'roster' }, { replace: true });
  };

  const onRegeneratePayLink = async (student) => {
    try {
      const result = await regeneratePayLink(student._id || student.id);
      success(
        result?.payLink
          ? `New pay link for ${student.studentName}: ${result.payLink}`
          : `Pay link regenerated for ${student.studentName}`
      );
      refresh();
    } catch (err) {
      errorToast(err.message);
    }
  };

  const onSaved = (saved, wasEdit) => {
    success(wasEdit ? `${saved?.studentName || 'Student'} updated` : `${saved?.studentName || 'Student'} added`);
    setEditing(null);
    setCreating(false);
    refresh();
  };

  const bulkHandlers = useMemo(
    () => ({
      previewBulkUpdate: (target, update) =>
        bulkUpdateStudents(target, update, undefined, { dryRun: true }).then((result) => {
          if (!result.ok) throw result.error;
          return result.result;
        }),
      bulkUpdate: (target, update) =>
        bulkUpdateStudents(target, update).then((result) => {
          if (!result.ok) throw result.error;
          success(`${formatCount(result.result.updated)} students updated`);
          selection.clear();
          refresh();
          return result.result;
        }),
      bulkArchive: (target, options) =>
        bulkArchiveStudents(target, options).then((result) => {
          if (!result.ok) {
            // A 409 here is a refusal with a list attached, not a failure to
            // report — the dialog needs the list, so it is handed the error.
            throw result.error;
          }
          success(`${formatCount(result.result.archived)} students archived`);
          selection.clear();
          refresh();
          return result.result;
        }),
      bulkStatus: (target, status, options) =>
        bulkSetStatus(target, status, options).then((result) => {
          if (!result.ok) throw result.error;
          const { changed, failed } = result.result;
          success(
            failed
              ? `${formatCount(changed)} updated, ${formatCount(failed)} skipped`
              : `${formatCount(changed)} students updated`
          );
          selection.clear();
          refresh();
          return result.result;
        }),
      bulkPayLinks: (target) =>
        bulkRegeneratePayLinks(target).then((result) => {
          if (!result.ok) throw result.error;
          success(`${formatCount(result.result.regenerated)} pay links regenerated`);
          selection.clear();
          refresh();
          return result.result;
        }),
    }),
    [success, selection, refresh]
  );

  const onBulkError = (err) => {
    // `details` carries the refusal list for an outstanding-balance archive.
    const refused = err?.details?.errors?.length;
    if (refused) {
      warning(
        `${formatCount(refused)} students have an outstanding balance and were not archived. Open the list to see who.`
      );
      return;
    }
    errorToast(err?.message || 'That bulk action could not be completed.');
  };

  if (tab === 'import') {
    return (
      <>
        <PageHeader
          eyebrow="Students"
          title="Students & Fee Roster"
          description="Bring a whole class in at once, or add them one at a time."
        />
        <ModuleTabs items={TABS} value={tab} onChange={setTab} ariaLabel="Students sections" />
        <ImportTab
          school={school}
          onImported={() => {
            refresh();
            setTab('roster');
          }}
        />
      </>
    );
  }

  if (tab === 'alumni' || tab === 'cohorts') {
    return (
      <>
        <PageHeader
          eyebrow="Students"
          title="Students & Fee Roster"
          description="Students who have graduated, and the cohorts they left with."
        />
        <ModuleTabs items={TABS} value={tab} onChange={setTab} ariaLabel="Students sections" />
        {tab === 'alumni' ? <AlumniTab schoolId={user?.schoolId} /> : <CohortsTab schoolId={user?.schoolId} />}
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Students"
        title="Students & Fee Roster"
        description={
          meta?.total
            ? `Showing ${formatCount(meta.total)} ${meta.total === 1 ? 'student' : 'students'} on the roster.`
            : 'Everyone on the roster, and every change their record can go through.'
        }
        actions={
          <>
            <button
              type="button"
              onClick={onExport}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export Roster
            </button>
            <button
              type="button"
              onClick={() => setCreating(true)}
              disabled={!classes.length}
              title={classes.length ? undefined : 'Add a class to your school first'}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Add New Student
            </button>
          </>
        }
      />

      <ModuleTabs items={TABS} value={tab} onChange={setTab} ariaLabel="Students sections" />

      <RosterKpiRow stats={stats} loading={statsLoading} />

      <RosterFilterBar
        filters={filters}
        setFilter={setFilter}
        clearFilters={clearFilters}
        hasFilters={hasFilters}
        classes={classes}
      />

      <StudentTable
        rows={rows}
        loading={loading}
        error={error}
        meta={meta}
        filters={filters}
        hasFilters={hasFilters}
        selection={selection}
        onSort={(patch) => setFilter(patch)}
        onPageChange={(page) => setFilter({ page }, { resetPage: false })}
        onPerPageChange={(perPage) => setFilter({ perPage })}
        onOpenProfile={(student) => setProfileId(student._id || student.id)}
        onEdit={(student) => setEditing(student)}
        onClearFilters={clearFilters}
        onMessage={onMessage}
        onRegeneratePayLink={onRegeneratePayLink}
      />

      <BulkActionBar selection={selection} onDone={bulkHandlers} onError={onBulkError} />

      <StudentProfileDrawer
        open={Boolean(profileId)}
        studentId={profileId}
        onClose={() => setProfileId(null)}
      />

      <StudentForm
        open={creating}
        classes={classes}
        onClose={() => setCreating(false)}
        onSaved={onSaved}
      />

      <StudentForm
        open={Boolean(editing)}
        student={editing}
        classes={classes}
        onClose={() => setEditing(null)}
        onSaved={onSaved}
      />
    </>
  );
};

export default Students;
