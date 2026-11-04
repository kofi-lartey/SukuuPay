import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getStudentLms, startStudentLmsAssessment, submitStudentLmsAssessment } from '../../services/student';
import { BookOpen, ClipboardList, PlayCircle, CheckCircle2, Clock, ChevronRight, Calendar, Sparkles, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { STUDENT_ROUTES } from '../../utils/constants';
import AssessmentPreview from '../../components/lms/AssessmentPreview';
import StudentQuizView from '../../components/lms/StudentQuizView';
import ResourcePreview from "../../components/lms/ResourcePreview";

const isNew = (date) => {
  if (!date) return false;
  return Date.now() - new Date(date).getTime() < 7 * 24 * 60 * 60 * 1000;
};

const Lms = () => {
  const { user } = useAuth();
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('auth_token') === 'student-demo-token';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('courses');
  const [selected, setSelected] = useState(null);
  const [openModule, setOpenModule] = useState(null);
  const [view, setView] = useState('home');
  const [taking, setTaking] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [previewAssessment, setPreviewAssessment] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [feedbackAssessment, setFeedbackAssessment] = useState(null);

  const load = async () => {
    if (isDemo) {
      const d = { student: { name: user?.name || 'Student', class: user?.studentClass || '' }, studyPlans: [], assessments: [] };
      setData(d);
      setLoading(false);
      return d;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getStudentLms();
      const payload = res?.data?.data || res?.data || null;
      setData(payload);
      const courses = payload?.studyPlans || [];
      if (courses.length && !selected) {
        setSelected(courses[0]);
        setOpenModule(courses[0]?.lessons?.[0]?.id || null);
      }
      // resume in-progress assessment
      try {
        const saved = JSON.parse(localStorage.getItem('lms_taking') || 'null');
        if (saved?.assessmentId) {
          const a = (payload?.assessments || []).find((x) => x._id === saved.assessmentId);
          if (a && !a.submission) {
            setTaking(a);
            setExpiresAt(saved.expiresAt);
            setView('taking');
          } else {
            localStorage.removeItem('lms_taking');
          }
        }
      } catch {}
      return payload;
    } catch (e) {
      setError('Could not load learning materials.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-[13px] font-semibold">Loading your learning materials...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <p className="text-[13px] font-semibold text-amber-900">{error}</p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-[12px] font-extrabold text-white hover:bg-amber-700">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (view === 'preview' && previewAssessment) {
    return (
      <AssessmentPreview
        assessment={previewAssessment}
        onBack={() => { setView('home'); setPreviewAssessment(null); }}
        onStart={async (a) => {
          try {
            const res = await startStudentLmsAssessment(a._id);
            const payload = res?.data?.data || res?.data;
            if (payload?.locked) {
              alert('This assessment has already been submitted.');
              setView('home');
              setPreviewAssessment(null);
              load();
              return;
            }
            setTaking(a);
            setExpiresAt(payload?.expiresAt || null);
            setView('taking');
            try { localStorage.setItem('lms_taking', JSON.stringify({ assessmentId: a._id, expiresAt: payload?.expiresAt })); } catch {}
          } catch (e) {
            alert(e?.response?.data?.message || 'Could not start assessment');
          }
        }}
      />
    );
  }
  if (view === 'taking' && taking) {
    return (
      <StudentQuizView
        assessment={taking}
        student
        submitUrl={`/student/lms/assessments/${taking._id}/submit`}
        expiresAt={expiresAt}
        onDone={() => { setTaking(null); setExpiresAt(null); setView('home'); try { localStorage.removeItem('lms_taking'); } catch {} load(); }}
      />
    );
  }

  if (view === 'feedback' && feedbackAssessment) {
    const a = feedbackAssessment;
    const sub = a.submission || {};
    const questions = a.questions || [];
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <button type="button" onClick={() => { setView('home'); setFeedbackAssessment(null); load(); }} className="text-sm text-slate-600 hover:text-slate-900">← Back</button>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-extrabold text-ink">{a.title}</h2>
          <p className="text-xs text-slate-500 mt-1">{a.className} · {a.subject}</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-[12px] font-extrabold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">Score: {sub.totalScore ?? 0} / {(a.questions || []).reduce((s, q) => s + (q.points || 0), 0)}</span>
            <span className="text-[12px] font-extrabold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">{sub.status}</span>
          </div>
        </div>
        <div className="space-y-3">
          {(sub.answers || []).map((ans, idx) => {
            const q = questions.find((x) => String(x._id) === String(ans.questionId));
            const isEssay = q?.type === 'essay';
            const cardClass = isEssay
              ? 'border-amber-200 bg-amber-50/40'
              : ans.isCorrect
              ? 'border-emerald-200 bg-emerald-50/40'
              : 'border-rose-200 bg-rose-50/40';
            return (
              <div key={ans.questionId || idx} className={`rounded-2xl border p-5 shadow-sm space-y-2 ${cardClass}`}>
                <p className="text-[13px] font-extrabold text-ink">Q{idx + 1}. {q?.questionText}</p>
                <div className="bg-white/70 p-3 rounded-xl text-[12.5px] text-slate-700 whitespace-pre-wrap">{ans.studentAnswer}</div>
                {q?.type === 'multiple_choice' && (
                  <p className={`text-[11.5px] font-semibold ${ans.isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>Correct: {q.correctAnswer} · {ans.isCorrect ? '✓ Correct' : '✗ Incorrect'} · {ans.scoreAwarded} pts</p>
                )}
                {isEssay && (
                  <p className="text-[11.5px] font-semibold text-amber-700">Essay · {ans.scoreAwarded} pts awarded{ans.teacherFeedback ? '' : ' (pending review)'}</p>
                )}
                {ans.teacherFeedback && (
                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
                    <p className="text-[11px] font-extrabold text-emerald-800 mb-1">Teacher feedback</p>
                    <p className="text-[12.5px] text-emerald-900 whitespace-pre-wrap">{ans.teacherFeedback}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (selectedCourse) {
    const c = selectedCourse;
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <button type="button" onClick={() => setSelectedCourse(null)} className="text-sm text-slate-600 hover:text-slate-900">← Back</button>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-ink">{c.title}</h2>
            {isNew(c.createdAt) && <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-md"><Sparkles className="h-3 w-3" />New</span>}
          </div>
          <p className="text-[11px] text-slate-400">{c.className} · {c.subject} · {c.term} {c.academicYear}</p>
          <p className="text-[12.5px] text-slate-600">{c.description}</p>
          <div className="space-y-4">
            {(c.lessons || []).map((l, idx) => {
              const linkedAssessment = l.assessmentId ? (data?.assessments || []).find((a) => String(a._id) === String(l.assessmentId)) : null;
              return (
              <div key={idx} className="rounded-2xl border border-slate-100 p-4 space-y-2">
                <p className="text-[13px] font-extrabold text-ink">{idx + 1}. {l.title}</p>
                {l.content && <div className="text-[12.5px] text-slate-700 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: l.content }} />}
                {(l.resourceLinks || []).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-slate-500 uppercase">Resources</p>
                    {(l.resourceLinks || []).map((r, j) => (
                      <ResourcePreview key={j} resource={r} />
                    ))}
                  </div>
                )}
                {linkedAssessment && (
                  <div className="pt-2 border-t border-slate-100">
                    {linkedAssessment.submission ? (
                      <p className="text-xs text-emerald-700 font-semibold">Assessment: {linkedAssessment.title} — {linkedAssessment.submission.status} · Score {linkedAssessment.submission.totalScore}</p>
                    ) : (
                      <button type="button" onClick={() => { setPreviewAssessment(linkedAssessment); setView('preview'); }} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-3 py-1.5 text-[11.5px] font-extrabold text-white hover:bg-brand-800">Take assessment: {linkedAssessment.title}</button>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const studyPlans = data?.studyPlans || [];
  const assessments = (data?.assessments || []).filter((a) => !a.attachedToLesson);
  const newPlans = studyPlans.filter((p) => isNew(p.createdAt)).length;
  const newAssessments = assessments.filter((a) => isNew(a.createdAt) && !a.submission).length;

  const TABS = [
    { key: 'courses', label: 'Courses', icon: BookOpen, count: 0 },
    { key: 'assessments', label: 'Assessments', icon: ClipboardList, count: newAssessments },
  ];

  // "Courses" view maps study plans grouped; reuse studyPlans as course list proxy
  const courseList = studyPlans;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><BookOpen className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">Learning (LMS)</h1>
            <p className="text-[13px] font-semibold text-slate-500">Courses, assessments and study plans from your teachers</p>
          </div>
        </div>
        <Link to={STUDENT_ROUTES.notifications} className="relative inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-200">
          <Clock className="h-4 w-4" /> Due soon
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-bold transition ${tab === t.key ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
              <Icon className="h-4 w-4" />
              {t.label}
              {t.count > 0 && <span className={`ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold ${tab === t.key ? 'bg-white text-brand-700' : 'bg-rose-500 text-white'}`}>{t.count}</span>}
            </button>
          );
        })}
      </div>

       {tab === 'courses' && (
        <div className="space-y-3">
          {courseList.length === 0 && <p className="text-sm text-slate-500">No courses available yet.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courseList.map((c) => (
              <div key={c._id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {c.coverImage && <img src={c.coverImage} alt={c.title} className="h-32 w-full object-cover" />}
                <div className="p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-extrabold text-ink">{c.title}</p>
                    {isNew(c.createdAt) && <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-md"><Sparkles className="h-3 w-3" />New</span>}
                  </div>
                  <p className="text-[11px] text-slate-400">{c.className} · {c.subject}</p>
                  <p className="text-[12.5px] text-slate-600">{c.description}</p>
                  <p className="text-[11px] text-slate-400">{(c.lessons || []).length} lessons</p>
                  <button type="button" onClick={() => setSelectedCourse(c)} className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-3 py-1.5 text-[11.5px] font-extrabold text-white hover:bg-brand-800">Open course</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'assessments' && (
        <div className="space-y-3">
          {assessments.length === 0 && <p className="text-sm text-slate-500">No assessments assigned yet.</p>}
          {assessments.map((a) => (
            <div key={a._id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-extrabold text-ink truncate">{a.title}</p>
                  {isNew(a.createdAt) && !a.submission && <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-md"><Sparkles className="h-3 w-3" />New</span>}
                </div>
                <p className="text-[11px] text-slate-400">{a.className} · {a.subject}</p>
                <p className="text-[11px] text-amber-600 mt-0.5 flex items-center gap-1"><Clock className="h-3 w-3" />Due {a.dueDate ? new Date(a.dueDate).toLocaleString() : '-'}</p>
                {a.durationMinutes > 0 && <p className="text-[11px] text-blue-600 mt-0.5 flex items-center gap-1"><Clock className="h-3 w-3" />Time limit: {a.durationMinutes} min</p>}
                {a.submission && <p className="text-[11.5px] text-emerald-700 mt-1 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Score: {a.submission.totalScore} / {(a.questions || []).reduce((s, q) => s + (q.points || 0), 0)} · {a.submission.status}</p>}
              </div>
              {!a.submission ? (
                <button type="button" onClick={() => { setPreviewAssessment(a); setView('preview'); }} className="rounded-xl bg-brand-700 px-3 py-1.5 text-[11.5px] font-extrabold text-white hover:bg-brand-800 shrink-0">Open</button>
              ) : (
                <button type="button" onClick={() => { setFeedbackAssessment(a); setView('feedback'); }} className="rounded-xl bg-slate-100 px-3 py-1.5 text-[11.5px] font-extrabold text-slate-700 hover:bg-slate-200 shrink-0">View feedback</button>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
};

export default Lms;
