import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createPaymentPlan,
  getStudentPlan,
  projectSchedule,
  today,
} from '../services/paymentPlans';
import { getStudent } from '../services/students';
import { useToast } from './useToast';

/**
 * The Create Payment Plan screen.
 *
 * One hook rather than a form component with internal state, because three
 * different surfaces read the same numbers and they must not be able to disagree:
 * the three summary tiles, the tranche projection rail, and the total the submit
 * button will act on. A bursar who sees "Total to recover GH₵ 550.00" in the rail
 * and a "GH₵ 850.00" on the button has been shown a screen with two plans in it.
 *
 * **The projection is computed client-side, not fetched.** A round trip per
 * keystroke and per segmented-control click would make the rail flicker and
 * freeze the whole form on a slow connection, and the maths is four lines that
 * already have a byte-for-byte server mirror in `services/paymentPlans.js`. The
 * duplication is the price of a live preview; `.mockcheck`'s "the client and the
 * server agree on the schedule" check is what keeps it honest.
 */

const DEFAULT_REMINDER_DAYS = 3;
const DEFAULT_REMINDER_TIME = '09:00';

/**
 * Reads a student for the plan form.
 *
 * The screen needs three things the roster list does not carry: the balance, the
 * parents' names and numbers, and whether a live plan already exists. The last is
 * why this is a separate fetch rather than a row click — the server refuses a
 * second live plan with a 409, and finding that out on submit would be a
 * completely avoidable dead end.
 */
export const usePlanBuilder = (studentId) => {
  const toast = useToast();
  const [student, setStudent] = useState(null);
  const [existingPlan, setExistingPlan] = useState(null);
  const [loading, setLoading] = useState(Boolean(studentId));
  const [loadError, setLoadError] = useState(null);

  const [numberOfInstallments, setNumberOfInstallments] = useState(3);
  const [interval, setInterval] = useState('monthly');
  const [startDate, setStartDate] = useState(today);
  const [planName, setPlanName] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [autoCollect, setAutoCollect] = useState(true);
  const [reminderDays, setReminderDays] = useState(DEFAULT_REMINDER_DAYS);
  const [reminderTime, setReminderTime] = useState(DEFAULT_REMINDER_TIME);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [result, setResult] = useState(null);

  // ── Load the student and any live plan ──
  useEffect(() => {
    if (!studentId) {
      setStudent(null);
      setExistingPlan(null);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setLoadError(null);

    // The plan lookup is a *separate* request from the student, and a 404 on it is
    // the normal "this student has no plan yet" answer rather than a failure — the
    // service maps it to `null`. Folding it into the student fetch would mean one
    // endpoint has to express "a student, plus optionally a plan", and the roster
    // list would then carry a plan object nobody else needs.
    Promise.all([getStudentPlan(studentId), getStudent(studentId)])
      .then(([plan, roster]) => {
        if (!active) return;
        setStudent(roster);
        setExistingPlan(plan?.plan || null);
      })
      .catch((error) => {
        if (!active) return;
        setStudent(null);
        setLoadError(error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [studentId]);

  // ── The three figures the design's header band shows ──
  //
  // "Balance to Structure" is `balance`, not `totalOwed`. The plan is written
  // against what is still outstanding, and structuring the gross total would
  // collect the deposit a second time. Getting this wrong produces a plan that
  // is arithmetically valid and asks the family for money they have already paid.
  const figures = useMemo(() => {
    const totalOwed = student?.totalOwed ?? 0;
    const balance = student?.balance ?? 0;
    return {
      totalOwed,
      paidDeposit: Math.max(totalOwed - balance, 0),
      balanceToStructure: balance,
    };
  }, [student]);

  // ── The projected schedule ──
  const projection = useMemo(
    () =>
      projectSchedule({
        totalAmount: figures.balanceToStructure,
        numberOfInstallments,
        startDate,
        interval,
      }),
    [figures.balanceToStructure, numberOfInstallments, startDate, interval]
  );

  const totalProjected = useMemo(
    () => projection.reduce((sum, tranche) => sum + tranche.amount, 0),
    [projection]
  );

  // The parent. `primary` first, matching the server's own resolution, so the
  // number shown here is the one the acceptance SMS actually goes to.
  const guardian = useMemo(() => {
    const parents = student?.parents || [];
    return parents.find((parent) => parent.isPrimary) || parents[0] || null;
  }, [student]);

  /**
   * Whether the form can be submitted, and why not when it cannot.
   *
   * A blocked form is stated in words. A disabled button with no explanation is
   * a screen a bursar clicks repeatedly and then asks a colleague about.
   */
  const blocker = useMemo(() => {
    if (!student) return 'Pick a student to structure a plan for.';
    if (!figures.balanceToStructure) return 'This student has no outstanding balance to structure.';
    if (existingPlan) {
      return `This student already has a ${existingPlan.planStatus?.replace(/_/g, ' ')} plan. Cancel it before creating another.`;
    }
    if (!startDate) return 'Choose the first tranche due date.';
    if (new Date(`${startDate}T00:00:00Z`) < new Date(`${today()}T00:00:00Z`)) {
      return 'A plan cannot start in the past.';
    }
    if (totalProjected !== figures.balanceToStructure) {
      return 'The tranches do not add up to the outstanding balance.';
    }
    return null;
  }, [student, figures.balanceToStructure, existingPlan, startDate, totalProjected]);

  const canSubmit = blocker === null;

  const save = useCallback(async () => {
    if (!studentId) return null;
    setSaving(true);
    setSaveError(null);
    try {
      const created = await createPaymentPlan(studentId, {
        numberOfInstallments,
        interval,
        startDate,
        planName: planName.trim() || `${numberOfInstallments}-Month Plan`,
        adminNotes: adminNotes.trim(),
      });
      setResult(created);
      toast.success(
        `Plan created for ${student?.studentName || 'the student'}. ${created.plan?.numberOfInstallments} tranches scheduled.`
      );
      return created;
    } catch (error) {
      setSaveError(error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [
    studentId,
    numberOfInstallments,
    interval,
    startDate,
    planName,
    adminNotes,
    student,
    toast,
  ]);

  const reset = useCallback(() => {
    setNumberOfInstallments(3);
    setInterval('monthly');
    setStartDate(today);
    setPlanName('');
    setAdminNotes('');
    setAutoCollect(true);
    setReminderDays(DEFAULT_REMINDER_DAYS);
    setReminderTime(DEFAULT_REMINDER_TIME);
    setSaveError(null);
    setResult(null);
  }, []);

  return {
    // Data
    student,
    guardian,
    existingPlan,
    loading,
    loadError,
    schoolId: student?.schoolId || null,

    // Form
    numberOfInstallments,
    setNumberOfInstallments,
    interval,
    setInterval,
    startDate,
    setStartDate,
    planName,
    setPlanName,
    adminNotes,
    setAdminNotes,
    autoCollect,
    setAutoCollect,
    reminderDays,
    setReminderDays,
    reminderTime,
    setReminderTime,

    // Derived
    figures,
    projection,
    totalProjected,
    blocker,
    canSubmit,

    // Actions
    save,
    saving,
    saveError,
    result,
    reset,
  };
};

export default usePlanBuilder;
