import React, { useState } from 'react';
import { Bell, BookOpen, CalendarCheck, ChevronRight, KeyRound, LogOut, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import AvatarUpload from '../../components/common/AvatarUpload';
import { Field } from '../../components/common/FormField';
import { roleLabel } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';
import useToast from '../../hooks/useToast';
import { updateMe } from '../../services/user';
import { TEACHER_ROUTES } from '../../utils/constants';
import { validateProfilePatch } from '../../utils/profileForm';

const SHORTCUTS = [
  { key: 'classes', label: 'My Classes', to: TEACHER_ROUTES.classes, icon: Users },
  { key: 'schedule', label: 'My Schedule', to: TEACHER_ROUTES.schedule, icon: BookOpen },
  { key: 'attendance', label: 'Attendance', to: TEACHER_ROUTES.attendance, icon: CalendarCheck },
  { key: 'notifications', label: 'Notifications', to: TEACHER_ROUTES.notifications, icon: Bell },
];

/**
 * The teacher's profile, and their settings.
 *
 * "More" in the bottom bar, and the target of the rail's Settings section — so
 * this one screen is now both: the shortcuts it always carried, and the two
 * things a teacher can change about themselves, which there was previously no
 * UI for anywhere:
 *
 *   1. **Their picture.** The hero block hosts `AvatarUpload`, which uploads to
 *      `POST /upload/avatar`, replaces the old asset server-side and puts the
 *      returned user straight into `AuthContext`. That last part is what makes
 *      it feel like it worked: the rail's avatar, the top bar's name and this
 *      card all read the same object, so one upload updates all of them.
 *
 *   2. **Their details** — name, position, phone. Read-only display was the
 *      honest option, but a settings screen where nothing is settable is a dead
 *      end, and these three are already on the server's `updateUserSchema`, so
 *      saving them is a PATCH rather than new API surface.
 *
 * ## What is deliberately *not* here
 *
 * A password field. SukuuPay has no change-password endpoint for a signed-in
 * session — the flow is "forgot password", which re-mints over email — and
 * building a local one would mean inventing half of an authentication
 * mechanism. That is a backend change, not a screen.
 *
 * Notifications preferences, either: the notification *list* is the feature
 * that exists. A preferences panel against a model that stores no preferences
 * would be decoration.
 */
const TeacherProfile = () => {
  const { user, logout } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({
    name: user?.name || '',
    position: user?.position || '',
    phone: user?.phone || '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    // Clear a field's error as soon as it is edited: the message has served its
    // purpose, and leaving it up while the fix is typed reads as an accusation.
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  const save = async (event) => {
    event.preventDefault();

    const found = validateProfilePatch(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const patch = {
        name: form.name.trim(),
        position: form.position.trim(),
        phone: form.phone.trim(),
      };
      const updated = await updateMe(user._id || user.id, patch);
      if (updated?.name) {
        // Put the saved values back, so a field trimmed server-side (or
        // normalised) does not show what was typed rather than what was saved.
        setForm({
          name: updated.name || '',
          position: updated.position || '',
          phone: updated.phone || '',
        });
      }
      toast.success('Your details have been saved.');
    } catch (error) {
      // A 422 from Joi comes back with `details` keyed by field, which is the
      // server telling this form exactly which line is wrong — the same
      // information the local rules would have produced, so it is used rather
      // than replaced by a generic banner.
      const fieldErrors = error?.details || {};
      if (Object.keys(fieldErrors).length) {
        setErrors(
          Object.fromEntries(
            Object.entries(fieldErrors).map(([key, value]) => [key, String(value)])
          )
        );
      }
      toast.error(error.message || 'We could not save your details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Identity and picture ── */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-slate-400">
          Your picture
        </h2>

        <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <AvatarUpload size="lg" />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-extrabold text-ink">
              {user?.name || 'Teacher'}
            </p>
            <p className="truncate text-[12.5px] font-bold text-brand-800">
              {roleLabel(user?.role)}
            </p>
            <p className="truncate text-[12.5px] text-slate-500">
              {user?.position || 'Teacher'}
            </p>
            <p className="mt-0.5 truncate text-[11.5px] text-slate-400">{user?.email}</p>
          </div>
        </div>
      </section>

      {/* ── Your details ── */}
      <form onSubmit={save} noValidate>
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-slate-400">
              Your details
            </h2>
            <span className="text-[11px] font-semibold text-slate-400">
              What your school sees
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <Field
              label="Full name"
              value={form.name}
              onChange={set('name')}
              error={errors.name}
              autoComplete="name"
              hint="The name your school sees on registers and reports."
            />
            <Field
              label="Position"
              value={form.position}
              onChange={set('position')}
              error={errors.position}
              placeholder="e.g. JHS 2 form teacher"
              hint="Optional."
            />
            <Field
              label="Phone"
              value={form.phone}
              onChange={set('phone')}
              error={errors.phone}
              placeholder="0244 123 4567"
              autoComplete="tel"
              inputMode="tel"
              hint="Optional. Used by your school to reach you."
            />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-sky-700 disabled:opacity-50"
            >
              {saving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {saving ? 'Saving…' : 'Save details'}
            </button>
            <p className="text-[11.5px] font-medium text-slate-400">
              Email is changed only by your school admin.
            </p>
          </div>
        </section>
      </form>

      {/* ── Shortcuts — what "More" always was ── */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-slate-400">
          Security
        </h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-slate-800">Password</p>
            <p className="text-[11.5px] text-slate-500">
              Change your password via a secure link sent to your email.
            </p>
          </div>
          <Link
            to={`/reset-password${user?.email ? `?email=${encodeURIComponent(user.email)}` : ""}`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
          >
            <KeyRound className="h-4 w-4 text-slate-500" aria-hidden="true" />
            Change password
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-1">
        {SHORTCUTS.map((row) => (
          <Link
            key={row.key}
            to={row.to}
            className="flex min-h-[52px] items-center gap-3 rounded-xl px-3 transition-colors hover:bg-slate-50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <row.icon className="h-[17px] w-[17px]" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-slate-800">
              {row.label}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          </Link>
        ))}
      </section>

      {/*
        Sign out.

        Kept here even though the rail now carries one too, because this screen
        is what the mobile bottom bar opens — a teacher signing out on a handset
        should not have to know the rail exists.
      */}
      <button
        type="button"
        onClick={logout}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-[13.5px] font-extrabold text-red-700 transition-colors hover:bg-red-100"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Sign out
      </button>

      <p className="pt-2 text-center text-[11px] font-semibold text-slate-400">
        SukuuPay · Teacher Portal v1.0
      </p>
    </div>
  );
};

export default TeacherProfile;
