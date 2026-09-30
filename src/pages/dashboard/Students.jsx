import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleAlert, Download, UserPlus } from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import ModuleTabs from '../../components/dashboard/ModuleTabs';
import RosterKpiRow from '../../components/students/RosterKpiRow';
import RosterFilterBar from '../../components/students/RosterFilterBar';
import StudentTable from '../../components/students/StudentTable';
import BulkActionBar from '../../components/students/BulkActionBar';
import StudentProfileDrawer from '../../components/students/StudentProfileDrawer';
import StudentForm from '../../components/students/StudentForm';
import ClassListEditor from '../../components/students/ClassListEditor';
import ImportTab from '../../components/students/ImportTab';
import AlumniTab from '../../components/students/AlumniTab';
import CohortsTab from '../../components/students/CohortsTab';
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

  // The class list, and *why* it is missing when it is.
  //
  // `studentClass` is validated against the school's own class list, so without
  // it the class dropdown is empty and Add Student cannot be used at all. The
  // previous version swallowed the failure and left the button disabled with a
  // tooltip blaming the school ("Add a class to your school first") — so a network
  // error or an unconfigured school read as a configuration problem, and the one
  // button the module exists for was dead with no explanation on screen.
  //
  // The list is now editable from here (`ClassListEditor`), because a school
  // provisioned through onboarding always starts with none and no other screen
  // in the app could ever create one.
  const [school, setSchool] = useState(null);
  const [schoolError, setSchoolError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileId, setProfileId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editingClasses, setEditingClasses] = useState(false);
  // Set when the class list was reached *via* Add New Student, so saving classes
  // continues straight into the form the user was actually trying to open.
  const [addAfterClasses, setAddAfterClasses] = useState(false);

  const { rows, meta, loading, error, filters, setFilter, clearFilters, hasFilters } =
    useStudents(reloadKey);
  const { stats, loading: statsLoading } = useStudentStats(filters);
  const selection = useRosterSelection(rows, filters);

  useEffect(() => {
    if (!user?.schoolId) return;
    let active = true;
    getSchool(user.schoolId)
      .then((result) => {
        if (!active) return;
        setSchool(result);
        setSchoolError(null);
      })
      .catch((error) => {
        if (!active) return;
        // Said out loud rather than swallowed: the class list is what Add Student
        // is built on, so failing to load it is a blocked action, not a
        // cosmetic gap in the filter row.
        setSchool(null);
        setSchoolError(error.message || 'Your school could not be loaded.');
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

  /**
   * A class save has to land in local state immediately rather than waiting for
   * a refetch: the whole point of the dialog is that Add Student works the
   * moment it closes, not one round trip later.
   */
  const onClassesSaved = useCallback(
    (next) => {
      setSchool((current) =>
        current ? { ...current, academic: { ...current.academic, classes: next } } : current
      );
      success(`${formatCount(next.length)} ${next.length === 1 ? 'class' : 'classes'} saved`);
      if (addAfterClasses) {
        setAddAfterClasses(false);
        setCreating(true);
      }
    },
    [success, addAfterClasses]
  );

  /**
   * A student cannot be created without a class, so when the school has none the
   * button opens the class list instead of a form whose class dropdown would be
   * empty. One action, no dead end — the previous version disabled the button
   * and left the user with a hover-only explanation.
   */
  const onAddStudent = () => {
    if (classes.length) {
      setCreating(true);
      return;
    }
    setAddAfterClasses(true);
    setEditingClasses(true);
  };

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
    if (wasEdit) {
      success(`${saved?.studentName || 'Student'} updated`);
    } else if (hasFilters) {
      // Clear the filters, because a freshly created student is active, owes the
      // full amount and has no plan — so "Overdue", "Fully Cleared", "On Track" or
      // a specific class will all exclude them. The record would be created
      // correctly and then be invisible, which reads as a failure to create it.
      setFilter({ class: '', feeStatus: '', planStatus: '', gender: '', status: 'active', page: 1 });
      success(
        `${saved?.studentName || 'Student'} added. Your filters were cleared so you can see them.`
      );
    } else {
      success(`${saved?.studentName || 'Student'} added`);
    }
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
              onClick={onAddStudent}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Add New Student
            </button>
          </>
        }
      />

      <ModuleTabs items={TABS} value={tab} onChange={setTab} ariaLabel="Students sections" />

      <RosterKpiRow stats={stats} loading={statsLoading} />

      {/* Said on the page, not only in a tooltip: with no class list, Add Student
          is unavailable, and a disabled button with a hover-only explanation is
          a dead end for anyone on a touch device. Both banners now offer the fix
          inline instead of pointing at a Settings page that does not exist. */}
      {schoolError && (
        <div className="mb-4 flex flex-wrap items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <p className="flex-1 text-[13px] font-semibold text-amber-900">
            <span className="font-extrabold">Your class list could not be loaded.</span> {schoolError}{' '}
            Adding a student needs it, because a student must be in a class your school
            defines.
          </p>
        </div>
      )}

      {school && !schoolError && !classes.length && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <CircleAlert className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <p className="flex-1 text-[13px] font-semibold text-slate-600">
            This school has no classes yet, so students cannot be added or promoted. Add
            your class list to get started.
          </p>
          <button
            type="button"
            onClick={() => setEditingClasses(true)}
            className="rounded-lg border border-brand-700 px-3 py-1.5 text-[12px] font-extrabold text-brand-700 transition-colors hover:bg-brand-50"
          >
            Set up classes
          </button>
        </div>
      )}

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

      <ClassListEditor
        open={editingClasses}
        schoolId={user?.schoolId}
        classes={classes}
        onClose={() => setEditingClasses(false)}
        onSaved={onClassesSaved}
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
