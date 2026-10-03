import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getSmsCredits,
  previewAudience,
  sendBulkSms,
  listSmsJobs,
  listSmsMessages,
  listSmsTemplates,
  createSmsTemplate,
  updateSmsTemplate,
  deleteSmsTemplate,
  cancelSmsJob,
  renderBodyLocally,
  countSegments,
  extractTokens,
} from '../services/sms';
import { useAuth } from '../context/AuthContext';

/**
 * The SMS Reminders module's state.
 *
 * The URL is the source of truth for *navigation* — which tab, which page, the
 * history filters — for the reason it is on every other module: a bursar sends a
 * colleague a link to "this week's broadcast" and it has to reopen that.
 *
 * The composer is the exception. The draft body, the chosen audience and the
 * rendered preview are `useState`, and deliberately not query parameters: they
 * are an unfinished thought, not a place. A draft body can be 1,600 characters
 * of a school's PTA copy with a parent's name in it, and `?body=…` puts that in
 * the URL, in browser history, in the Referer header of anything the page links
 * to, and in a screenshot in a support ticket. The cost of not sharing a draft
 * is low; the cost of leaking one is not.
 */

/** The four preset rows, matching `SMS_PRESET_TEMPLATES` on the server. */
export const PRESET_TEMPLATES = [
  {
    key: 'gentle_prompt',
    name: 'Gentle Prompt',
    category: 'fee_reminder',
    requiredTokens: ['balance', 'payLink'],
    body: 'Dear {parentName}, {studentName} owes GHC {balance} for this term at {schoolName}. Please pay via MTN MoMo, Telecel Cash or AirtelTigo: {payLink}',
  },
  {
    key: 'final_warning',
    name: 'Final Warning',
    category: 'final_warning',
    requiredTokens: ['balance', 'dueDate', 'payLink'],
    body: "Dear {parentName}, this is a final reminder for {studentName}'s GHC {balance} outstanding at {schoolName}. Fees must be cleared by {dueDate}. Pay now: {payLink}",
  },
  {
    key: 'pta_special',
    name: 'PTA Special',
    category: 'pta',
    requiredTokens: ['balance', 'payLink'],
    body: 'Dear {parentName}, the PTA of {schoolName} requests GHC {balance} from you for {studentName}. Pay via {payLink}. Thank you.',
  },
  {
    key: 'custom',
    name: 'Custom Message',
    category: 'custom',
    requiredTokens: ['balance', 'payLink'],
    body: 'Dear {parentName}, kindly settle the outstanding balance of GHC {balance} for {studentName} at {schoolName}. Payment link: {payLink}',
  },
];

/**
 * The token vocabulary offered in the composer.
 *
 * Deliberately a client copy of `SMS_TOKENS` in `config/constants.js`. The
 * server is the authority — it rejects an unknown token before anything is sent
 * — but the composer has to highlight and describe these rows as the user types,
 * and a `GET` for nine strings before the first keystroke is a round trip in
 * exchange for nothing. If the two lists ever diverge, the server's wins and the
 * user gets a 400 naming the offending token, which is the correct direction for
 * a mismatch to fail in.
 */
export const SMS_TOKENS = [
  { token: 'parentName', label: 'Parent name', sample: 'Mr. Mensah' },
  { token: 'studentName', label: 'Student name', sample: 'Kwame Mensah' },
  { token: 'studentClass', label: 'Class', sample: 'JHS 2A' },
  { token: 'balance', label: 'Amount owing', sample: '550.00' },
  { token: 'amountPaid', label: 'Already paid', sample: '0.00' },
  { token: 'dueDate', label: 'Due date', sample: '30 Nov 2025' },
  { token: 'schoolName', label: 'School name', sample: 'Prampram Basic School' },
  { token: 'payLink', label: 'Payment link', sample: 'sukuupay.com/pay/STU-8F3K9D2L' },
  { token: 'term', label: 'Term', sample: 'Term 1' },
];

/** The audience rules, in the order the picker lists them. */
export const AUDIENCE_RULES = [
  {
    value: 'all_owing',
    title: 'All Owing Students',
    description: 'Outstanding balance above GHC 0.00',
  },
  {
    value: 'overdue',
    title: 'Overdue Only',
    description: 'Past statutory 30-day grace period',
    badge: 'High Priority',
  },
  {
    value: 'installment_due_soon',
    title: 'Installment Due in 5 Days',
    description: 'Tranche 2 auto-scheduled reminders',
  },
  {
    value: 'class',
    title: 'By Specific Class',
    description: 'Target individual grades or wings',
  },
  {
    value: 'students',
    title: 'By Specific Students',
    description: 'Hand-picked from the roster',
  },
  {
    value: 'all',
    title: 'Whole School',
    description: 'Every active student, settled or not',
  },
];

const STORAGE_KEY = 'sukuupay.sms.draft.v1';

/**
 * The draft, persisted to `sessionStorage`.
 *
 * A half-written PTA message is an hour of someone's work, and a refresh should
 * not destroy it. `sessionStorage` rather than `localStorage` because this is
 * scratch work, not a preference: it should not outlive the browser session, and
 * it must not follow a bursar onto the next school's account on a shared machine.
 * Keys are namespaced per school, so switching school mid-session cannot show
 * one school's outstanding balances and pay links in another's draft.
 */
const readStoredDraft = (schoolId) => {
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_KEY}.${schoolId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // A corrupt or unreadable store is not worth a blank screen. A lost draft is
    // an inconvenience; a page that will not render is a bug.
    return null;
  }
};

const writeStoredDraft = (schoolId, draft) => {
  try {
    window.sessionStorage.setItem(`${STORAGE_KEY}.${schoolId}`, JSON.stringify(draft));
  } catch {
    // Storage full or blocked (private browsing). Drafting still works.
  }
};

const clearStoredDraft = (schoolId) => {
  try {
    window.sessionStorage.removeItem(`${STORAGE_KEY}.${schoolId}`);
  } catch {
    /* nothing to do */
  }
};

/**
 * The whole module's state, in one hook.
 *
 * Split up by concern rather than by screen because the three surfaces that use
 * it are not disjoint: the composer's send button, the history tab's cancel, and
 * the topbar's credit pill all read the same balance, and a send that updates one
 * and not the others is the "1,420 credits" discrepancy this page exists to stop.
 *
 * @param {number} reloadKey bumped by a caller to force a re-fetch after a
 *   mutation it did not perform (a payment settled elsewhere, a top-up on the
 *   Settings page). Same handle `useStudents` uses.
 */
export const useSmsReminders = (reloadKey = 0) => {
  const { user } = useAuth();
  const schoolId = user?.schoolId || null;

  const [searchParams, setSearchParams] = useSearchParams();

  // ── Navigation (in the URL) ──
  const tab = searchParams.get('tab') || 'compose';
  const historyFilters = useMemo(
    () => ({
      status: searchParams.get('status') || 'all',
      category: searchParams.get('category') || 'all',
      search: searchParams.get('q') || '',
      page: Number(searchParams.get('page')) || 1,
      perPage: Number(searchParams.get('perPage')) || 20,
    }),
    [searchParams]
  );

  const setParam = useCallback(
    (patch, { resetPage = true } = {}) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) next.delete(key);
        else next.set(key, String(value));
      });
      if (resetPage) next.delete('page');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // ── Credits ──
  const [credits, setCredits] = useState(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [creditsError, setCreditsError] = useState(null);

  // ── Templates ──
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  // ── Composer ──
  const stored = useMemo(() => readStoredDraft(schoolId), [schoolId]);

  const [audienceType, setAudienceType] = useState(stored?.audienceType || 'overdue');
  const [classFilter, setClassFilter] = useState(stored?.classFilter || '');
  /**
   * Explicit recipients for the `students` rule.
   *
   * Persisted in the draft alongside the other composer state, because picking four
   * names out of a thousand-student roster is the most expensive part of this screen
   * and a refresh must not throw it away. Restored defensively as an array of
   * strings: a draft from an older build could hold anything, and `studentIds` goes
   * straight into a query as `$in`.
   */
  const [studentIds, setStudentIds] = useState(() =>
    Array.isArray(stored?.studentIds) ? stored.studentIds.map(String) : []
  );
  const [minBalance, setMinBalance] = useState(stored?.minBalance ?? 1);
  const [overdueDays, setOverdueDays] = useState(stored?.overdueDays ?? 30);
  const [gracePeriodDays, setGracePeriodDays] = useState(stored?.gracePeriodDays ?? 30);
  const [dueSoonDays, setDueSoonDays] = useState(stored?.dueSoonDays ?? 5);
  const [excludeRecentPayers, setExcludeRecentPayers] = useState(
    stored?.excludeRecentPayers ?? true
  );
  const [recentPaymentWindowHours, setRecentPaymentWindowHours] = useState(
    stored?.recentPaymentWindowHours ?? 48
  );
  const [body, setBody] = useState(stored?.body || PRESET_TEMPLATES[0].body);
  const [category, setCategory] = useState(stored?.category || 'fee_reminder');
  const [templateId, setTemplateId] = useState(stored?.templateId || null);
  const [scheduledAt, setScheduledAt] = useState(stored?.scheduledAt || '');
  const [confirmed, setConfirmed] = useState(false);

  // ── Derived composer state ──
  const audience = useMemo(
    () => ({
      type: audienceType,
      minBalance: Number(minBalance) || 0,
      overdueDays: Number(overdueDays) || 30,
      gracePeriodDays: Number(gracePeriodDays) || 30,
      dueSoonDays: Number(dueSoonDays) || 5,
      excludeRecentPayers,
      recentPaymentWindowHours: Number(recentPaymentWindowHours) || 48,
      ...(audienceType === 'class' && classFilter ? { class: classFilter } : {}),
      // The one field the `students` rule needs. Omitted entirely when the list is
      // empty rather than sent as `studentIds: []`, because the schema reads an
      // empty array as "no recipients named" and refuses it — and because
      // `sms.service.js` turns it into `$in: []`, which is a query matching nobody
      // if it ever slipped past validation. The preview is suppressed below, so
      // this shape only exists between the two and the send is guarded by the
      // button.
      ...(audienceType === 'students' && studentIds.length ? { studentIds } : {}),
      // `all` is the one rule where a zero balance is coherent, and it says so
      // explicitly rather than by leaving `minBalance` at 0 — the server rejects
      // a whole-school broadcast that did not opt in.
      ...(audienceType === 'all' ? { includeZeroBalance: true } : {}),
    }),
    [
      audienceType,
      classFilter,
      studentIds,
      minBalance,
      overdueDays,
      gracePeriodDays,
      dueSoonDays,
      excludeRecentPayers,
      recentPaymentWindowHours,
    ]
  );

  const tokens = useMemo(() => extractTokens(body), [body]);
  const knownTokens = useMemo(() => new Set(SMS_TOKENS.map((entry) => entry.token)), []);
  const unknown = useMemo(() => tokens.filter((token) => !knownTokens.has(token)), [tokens, knownTokens]);

  /**
   * The values the handset preview renders against.
   *
   * The first real recipient from the audience preview, overlaid with the
   * composer's own sample. A preview built from a real student's record is worth
   * more than a generic one — the point of checking a reminder is to see the
   * *actual* balance and the *actual* pay link that parent will receive. Falls
   * back to the documented sample values so the preview is never empty.
   */
  const [previewSample, setPreviewSample] = useState(null);
  const sampleValues = useMemo(
    () => ({
      parentName: 'Mr. Mensah',
      studentName: 'Kwame Mensah',
      studentClass: 'JHS 2A',
      schoolName: user?.schoolName || 'Prampram Basic School',
      payLink: 'sukuupay.com/pay/STU-8F3K9D2L',
      term: 'Term 1',
      ...Object.fromEntries(
        SMS_TOKENS.filter((entry) => entry.sample && !['parentName', 'studentName', 'studentClass', 'schoolName', 'payLink', 'term'].includes(entry.token)).map((entry) => [entry.token, entry.sample])
      ),
      ...(previewSample
        ? {
            parentName: previewSample.parentName,
            studentName: previewSample.studentName,
            balance: previewSample.balanceDisplay,
            payLink: previewSample.payLink ? previewSample.payLink.replace(/^https?:\/\//, '') : undefined,
          }
        : {}),
    }),
    [previewSample, user?.schoolName]
  );

  const rendered = useMemo(() => renderBodyLocally(body, sampleValues), [body, sampleValues]);
  const segments = useMemo(() => countSegments(rendered), [rendered]);
  const perSegmentLimit = useMemo(
    () => (/^[\x20-\x7E\n\r]*$/.test(rendered) || /^[\x20-\x7E\n\r@£$¥èéùìòÇØøÅå]*$/.test(rendered) ? 160 : 70),
    [rendered]
  );
  const overSegmentLimit = segments > 10;

  // ── Audience preview ──
  const [audiencePreview, setAudiencePreview] = useState(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [audienceError, setAudienceError] = useState(null);

  // ── Actions ──
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sendResult, setSendResult] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busyJobId, setBusyJobId] = useState(null);

  // ── History ──
  const [jobs, setJobs] = useState([]);
  const [jobsMeta, setJobsMeta] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesMeta, setMessagesMeta] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  // ── Credits + templates ──
  useEffect(() => {
    if (!schoolId) {
      setCreditsLoading(false);
      return undefined;
    }
    let active = true;
    setCreditsLoading(true);
    getSmsCredits(schoolId)
      .then((result) => {
        if (!active) return;
        setCredits(result);
        setCreditsError(null);
      })
      .catch((error) => {
        if (!active) return;
        setCredits(null);
        setCreditsError(error);
      })
      .finally(() => {
        if (active) setCreditsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [schoolId, reloadKey]);

  const loadTemplates = useCallback(async () => {
    if (!schoolId) return;
    setTemplatesLoading(true);
    try {
      const result = await listSmsTemplates({ schoolId });
      setTemplates(result);
    } catch {
      // The presets are the important part, and they are seeded from
      // `PRESET_TEMPLATES` above. A failed fetch degrades to "the four presets
      // and no saved ones", which is still a usable composer.
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates, reloadKey]);

  // ── History ──
  const loadHistory = useCallback(async () => {
    if (!schoolId) return;
    setHistoryLoading(true);
    try {
      // Two requests, one effect. The job list and the message log answer
      // different questions ("what did I broadcast?" vs "what happened to the
      // messages?") and neither is a subset of the other, so a single endpoint
      // would have to fake one of them.
      const [jobResult, messageResult] = await Promise.all([
        listSmsJobs({ schoolId, status: 'all', category: 'all', ...historyFilters }),
        listSmsMessages({ schoolId, status: historyFilters.status, category: historyFilters.category, search: historyFilters.search, page: historyFilters.page, perPage: historyFilters.perPage }),
      ]);
      setJobs(jobResult.jobs);
      setJobsMeta(jobResult.meta);
      setMessages(messageResult.messages);
      setMessagesMeta(messageResult.meta);
      setHistoryError(null);
    } catch (error) {
      setHistoryError(error);
    } finally {
      setHistoryLoading(false);
    }
  }, [schoolId, historyFilters]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, reloadKey]);

  // ── Audience preview, debounced ──
  // Debounced rather than on every change because `classFilter` is a text input:
  // a request per keystroke is a request per keystroke against a query that
  // aggregates the whole roster. 400ms is long enough to coalesce a typed word
  // and short enough that the count still feels attached to the typing.
  const previewTimer = useRef(null);
  useEffect(() => {
    if (!schoolId) return undefined;

    // Two rules have nothing to resolve until the bursar names a target, and both
    // are answered in the form rather than with a request. `class` without a class
    // and `students` without a student are not server errors to display — they are
    // an incomplete form, and the picker says what is missing. Asking anyway is
    // what produced a red banner reading
    // `audience.type "students" requires studentIds` the instant someone selected
    // the rule, which reads as a broken feature rather than an unfinished one.
    const needsTarget =
      (audienceType === 'class' && !classFilter) || (audienceType === 'students' && !studentIds.length);
    if (needsTarget) {
      clearTimeout(previewTimer.current);
      setAudiencePreview(null);
      setAudienceError(null);
      setAudienceLoading(false);
      return undefined;
    }

    clearTimeout(previewTimer.current);
    setAudienceLoading(true);
    previewTimer.current = setTimeout(() => {
      previewAudience(audience, schoolId)
        .then((result) => {
          setAudiencePreview(result);
          setAudienceError(null);
          if (result?.sample) setPreviewSample(result.sample);
        })
        .catch((error) => {
          setAudiencePreview(null);
          setAudienceError(error);
        })
        .finally(() => setAudienceLoading(false));
    }, 400);

    return () => clearTimeout(previewTimer.current);
  }, [schoolId, audience, audienceType, classFilter, studentIds]);

  // ── Draft persistence ──
  useEffect(() => {
    if (!schoolId) return;
    writeStoredDraft(schoolId, {
      audienceType,
      classFilter,
      studentIds,
      minBalance,
      overdueDays,
      gracePeriodDays,
      dueSoonDays,
      excludeRecentPayers,
      recentPaymentWindowHours,
      body,
      category,
      templateId,
      scheduledAt,
    });
  }, [
    schoolId,
    audienceType,
    classFilter,
    studentIds,
    minBalance,
    overdueDays,
    gracePeriodDays,
    dueSoonDays,
    excludeRecentPayers,
    recentPaymentWindowHours,
    body,
    category,
    templateId,
    scheduledAt,
  ]);

  // ── What a send would cost ──
  // `null` rather than 0 while the audience is unknown: a send button showing
  // "GHC 0.00" next to an unresolved recipient count is a bursar clicking on a
  // lie. The button stays disabled until the number is real.
  const estimatedCost = audiencePreview?.matchCount ? segments * audiencePreview.matchCount : null;
  const affordable = credits?.balance !== undefined && estimatedCost !== null
    ? credits.balance >= estimatedCost
    : null;

  /** Applies a preset or a saved template to the composer. */
  const applyTemplate = useCallback((template) => {
    setBody(template.body);
    if (template.category) setCategory(template.category);
    // The id is cleared for a platform preset because there is nothing to update
    // server-side; a school's own template keeps its id so "Save changes" is an
    // edit rather than a duplicate that collides on the key.
    setTemplateId(template.schoolId ? template._id : null);
    setSendResult(null);
    setSendError(null);
  }, []);

  const resetComposer = useCallback(() => {
    setAudienceType('overdue');
    setClassFilter('');
    setMinBalance(1);
    setOverdueDays(30);
    setGracePeriodDays(30);
    setDueSoonDays(5);
    setExcludeRecentPayers(true);
    setRecentPaymentWindowHours(48);
    setBody(PRESET_TEMPLATES[0].body);
    setCategory('fee_reminder');
    setTemplateId(null);
    setScheduledAt('');
    setConfirmed(false);
    setSendResult(null);
    setSendError(null);
    clearStoredDraft(schoolId);
  }, [schoolId]);

  const saveTemplate = useCallback(
    async ({ name, body: body_, category: category_, id } = {}) => {
      if (!schoolId) return null;
      const payload = {
        name: name ?? 'Untitled template',
        body: body_ ?? body,
        category: category_ ?? category,
      };
      const saved = id
        ? await updateSmsTemplate(id, payload)
        : await createSmsTemplate({ ...payload, schoolId });
      await loadTemplates();
      return saved;
    },
    [schoolId, body, category, loadTemplates]
  );

  const removeTemplate = useCallback(
    async (id) => {
      await deleteSmsTemplate(id);
      if (String(templateId) === String(id)) setTemplateId(null);
      await loadTemplates();
    },
    [templateId, loadTemplates]
  );

  /**
   * Re-reads the balance.
   *
   * Exposed because the top-up dialog lives on this page but the number that
   * matters is on the header and in the cost estimate. A locally-incremented
   * balance is a guess about what the server did, and the one place it must not
   * be a guess is immediately after a top-up — a bursar who adds 1,000 credits
   * and still sees the old balance has no reason to press the button again.
   */
  const refreshCredits = useCallback(async () => {
    if (!schoolId) return null;
    try {
      const result = await getSmsCredits(schoolId);
      setCredits(result);
      return result;
    } catch (error) {
      setCreditsError(error);
      return null;
    }
  }, [schoolId]);

  /**
   * Queues the broadcast.
   *
   * The `confirmed` flag is not a courtesy: a whole-school broadcast needs an
   * explicit acknowledgement on the server too (`confirmBroadcast`), so a client
   * that skipped the dialog gets a 422 rather than 1,200 parents messaged.
   */
  const send = useCallback(async () => {
    // Refused here rather than left to the server's 422. Both the button's
    // `disabled` and this guard exist: the button state can be bypassed by a
    // keyboard shortcut on a focused element or by a draft restored with the rule
    // selected and the list emptied, and a send that reaches the server in that
    // state shows a bursar an error instead of telling them what to do.
    if (audienceType === 'students' && !studentIds.length) {
      const error = new Error('Pick at least one student, or choose a different audience.');
      setSendError(error);
      throw error;
    }

    setSending(true);
    setSendError(null);
    try {
      const result = await sendBulkSms({
        schoolId,
        audience,
        body,
        category,
        templateId: templateId || undefined,
        scheduledAt: scheduledAt || undefined,
        confirmBroadcast: audienceType === 'all' ? true : undefined,
      });

      setSendResult(result);
      setConfirmed(false);
      // The job and the balance both changed, and the composer's cost estimate
      // is now history. Re-reading the credits here rather than decrementing
      // locally is deliberate: the server's post-charge balance is the truth, and
      // a locally-computed one is the kind of figure that drifts.
      const refreshed = await getSmsCredits(schoolId);
      setCredits(refreshed);
      await loadHistory();
      return result;
    } catch (error) {
      setSendError(error);
      throw error;
    } finally {
      setSending(false);
    }
  }, [schoolId, audience, body, category, templateId, scheduledAt, audienceType, studentIds, loadHistory]);

  const cancelJob = useCallback(
    async (jobId) => {
      setBusyJobId(jobId);
      setActionError(null);
      try {
        await cancelSmsJob(jobId);
        await loadHistory();
        const refreshed = await getSmsCredits(schoolId);
        setCredits(refreshed);
      } catch (error) {
        setActionError(error);
        throw error;
      } finally {
        setBusyJobId(null);
      }
    },
    [schoolId, loadHistory]
  );

  return {
    // Scope
    schoolId,

    // Navigation
    tab,
    setTab: (value) => setParam({ tab: value }, { resetPage: false }),
    historyFilters,
    setHistoryFilter: (patch) => setParam(patch),
    clearHistoryFilters: () => setParam({ status: 'all', category: 'all', q: '' }, { resetPage: false }),

    // Credits
    credits,
    creditsLoading,
    creditsError,
    balance: credits?.balance ?? null,
    balanceCedis: credits?.balanceCedis ?? null,
    ratePes: credits?.ratePes ?? 12,
    deliveryRate: credits?.usage?.deliveryRate ?? null,
    usage: credits?.usage ?? null,
    topUps: credits?.topUps ?? [],
    // Whether a send would reach a handset at all. The composer states this
    // rather than letting a bursar compose 200 messages and discover it on send.
    canSend: credits?.canSend ?? null,
    gateway: credits?.gateway ?? null,

    // Templates
    templates,
    presets: PRESET_TEMPLATES,
    tokens: SMS_TOKENS,
    templatesLoading,
    applyTemplate,
    saveTemplate,
    removeTemplate,
    refreshCredits,
    reloadKey,

    // Composer
    audienceType,
    setAudienceType,
    audienceRules: AUDIENCE_RULES,
    classFilter,
    setClassFilter,
    studentIds,
    setStudentIds,
    minBalance,
    setMinBalance,
    overdueDays,
    setOverdueDays,
    gracePeriodDays,
    setGracePeriodDays,
    dueSoonDays,
    setDueSoonDays,
    excludeRecentPayers,
    setExcludeRecentPayers,
    recentPaymentWindowHours,
    setRecentPaymentWindowHours,
    body,
    setBody,
    category,
    setCategory,
    templateId,
    scheduledAt,
    setScheduledAt,
    confirmed,
    setConfirmed,

    // Derived
    audience,
    tokensInBody: tokens,
    unknownTokens: unknown,
    rendered,
    segments,
    perSegmentLimit,
    overSegmentLimit,
    audiencePreview,
    audienceLoading,
    audienceError,
    estimatedCost,
    affordable,
    canQueue:
      Boolean(body) &&
      unknown.length === 0 &&
      !overSegmentLimit &&
      audiencePreview?.matchCount > 0 &&
      affordable === true &&
      confirmed,

    // Actions
    send,
    sending,
    sendError,
    sendResult,
    resetComposer,
    cancelJob,
    busyJobId,
    actionError,

    // History
    jobs,
    jobsMeta,
    messages,
    messagesMeta,
    historyLoading,
    historyError,
    reloadHistory: loadHistory,
  };
};

export default useSmsReminders;
