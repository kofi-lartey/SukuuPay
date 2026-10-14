import React, { useId, useRef, useState } from 'react';
import { Camera, LoaderCircle, Trash2, X } from 'lucide-react';
import Modal from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { uploadAvatar, removeAvatar } from '../../services/uploads';
import {
  AVATAR_ACCEPT_ATTRIBUTE,
  initialsFor,
  validateAvatarFile,
} from '../../utils/avatar';

/**
 * A profile picture, and the two actions that change it.
 *
 * The state it renders is the session's own `user.avatar`, not local state: a
 * picture that survives a reload has to be the one the server has, and the
 * server is where the crop, the 256px square and the old asset's deletion all
 * happen. The moment an upload succeeds, the response's user goes into
 * `AuthContext` — the sidebar, the top bar and the profile screen all read the
 * same object, so clicking "Remove" here clears the face from all three at once
 * rather than leaving two of them showing a picture the account no longer has.
 *
 * ## Why the picker is a hidden input
 *
 * A native file input cannot be styled, and an `<img>` overlay needs the input
 * to be clickable under it. The pattern is a visually-hidden input that the
 * label (or the camera button) forwards a click to, which keeps the control a
 * real form element — keyboard focusable, announced by a screen reader, and
 * functional with JavaScript's click() — instead of a div with an onClick that
 * none of those three can reach.
 *
 * What each card shows is decided by the caller's props rather than by variants:
 * `showActions` drops the "Change picture / Remove" row for a dense host such as
 * the teacher rail, which wants the avatar and the camera badge only; `size`
 * moves between `sm` (rail), `md` (a settings card) and `lg` (a profile screen's
 * hero block); and `onBranded` inverts the chip for a filled brand card, the
 * one place the avatar sits on dark green rather than on white.
 *
 * ## Deleting is confirmed, uploading is not
 *
 * Removing a picture is a destructive act on the one thing in this portal that
 * is *about* the person, and it is not undoable from the UI, so it asks first.
 * Choosing a file is not: the worst case is a picture they replace in ten
 * seconds, and a confirm dialog between the pick and the upload is friction
 * with no information in it.
 */
const AvatarUpload = ({
  size = 'md',
  editable = true,
  showActions = true,
  showRemove = true,
  onBranded = false,
  onUpdated,
  className = '',
}) => {
  const { user, applyUser } = useAuth();
  const toast = useToast();

  const inputRef = useRef(null);
  const inputId = useId();
  const [busy, setBusy] = useState(null); // 'upload' | 'remove'
  const [error, setError] = useState('');
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const initials = initialsFor(user?.name);
  const hasAvatar = Boolean(user?.avatar);

  /**
   * `onBranded` inverts the chip for a filled card.
   *
   * The teacher rail fires its identity card in `bg-brand-700`, exactly as the
   * school console fires its school card — so the initials chip and the camera
   * badge have to be white-on-brand rather than the default light tint, or the
   * avatar is the one element on that card that reads as a different product.
   */
  const fallbackTint = onBranded
    ? 'bg-white/15 text-white'
    : 'bg-sky-100 text-sky-700';
  const fabTint = onBranded
    ? 'bg-white text-brand-700 hover:bg-white/90'
    : 'bg-sky-600 text-white hover:bg-sky-700';

  const dimensions = {
    sm: { box: 'h-9 w-9', text: 'text-[12px]', fab: 'h-4 w-4', radius: 'rounded-full' },
    md: { box: 'h-16 w-16', text: 'text-[20px]', fab: 'h-4 w-4', radius: 'rounded-full' },
    lg: { box: 'h-24 w-24', text: 'text-[30px]', fab: 'h-5 w-5', radius: 'rounded-full' },
  }[size] || {};

  const choose = () => {
    setError('');
    inputRef.current?.click();
  };

  const onFileChosen = async (event) => {
    const file = event.target.files?.[0];
    // Reset immediately: picking the same file twice must fire `change` both
    // times, and a teacher retrying after a failure is exactly that case.
    event.target.value = '';
    if (!file) return;

    const verdict = validateAvatarFile(file);
    if (!verdict.ok) {
      setError(verdict.message);
      return;
    }

    setBusy('upload');
    setError('');
    try {
      const result = await uploadAvatar(file);
      if (result.user) applyUser(result.user);
      else if (result.avatar) applyUser({ ...user, avatar: result.avatar });
      toast.success('Your picture has been updated.');
      onUpdated?.(result.user);
    } catch (uploadError) {
      setError(uploadError.message || 'We could not upload that picture. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const confirmRemove = async () => {
    setBusy('remove');
    setError('');
    try {
      const result = await removeAvatar();
      if (result.user) applyUser(result.user);
      else applyUser({ ...user, avatar: null });
      toast.success('Your picture has been removed.');
      setConfirmingRemove(false);
      onUpdated?.(result.user);
    } catch (removeError) {
      setError(removeError.message || 'We could not remove that picture. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative shrink-0">
        {hasAvatar ? (
          <img
            src={user.avatar}
            alt=""
            aria-hidden="true"
            className={`${dimensions.box} ${dimensions.radius} border-2 border-white object-cover shadow-lift`}
          />
        ) : (
          <span
            aria-hidden="true"
            className={`flex ${dimensions.box} items-center justify-center ${dimensions.radius} ${fallbackTint} ${dimensions.text} font-extrabold`}
          >
            {initials}
          </span>
        )}

        {/*
          The camera badge, over the bottom-right of the picture.

          Positioned absolute rather than inline so the avatar itself keeps its
          own dimensions — a badge inside the flow would widen the circle's row
          every time it appears. `pointer-events-none` on the wrapper span and
          `pointer-events-auto` on the button: the badge must be tappable without
          the avatar behind it swallowing the tap on the corners.
        */}
        {editable && (
          <span className="pointer-events-none absolute -bottom-0.5 -right-0.5">
            <button
              type="button"
              onClick={choose}
              disabled={busy !== null}
              aria-label={hasAvatar ? 'Change your picture' : 'Add a picture'}
              className={`pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border-2 border-white ${fabTint} shadow-lift transition-colors disabled:opacity-60`}
            >
              {busy === 'upload' ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </span>
        )}

        {/*
          The actual input.

          Hidden rather than `display: none`, which some browsers treat as
          "not focusable" and therefore skip entirely: `sr-only` keeps it in the
          accessibility tree and reachable by keyboard, so the camera button is
          a convenience over a control that already works without it.
        */}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={AVATAR_ACCEPT_ATTRIBUTE}
          onChange={onFileChosen}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>

      {editable && showActions && (
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={choose}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              {busy === 'upload' && <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {hasAvatar ? 'Change picture' : 'Upload picture'}
            </button>

            {hasAvatar && showRemove && (
              <button
                type="button"
                onClick={() => setConfirmingRemove(true)}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-bold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Remove
              </button>
            )}
          </div>

          <p className="mt-1 text-[11px] font-medium text-slate-400">
            JPG, PNG or WebP, up to 2 MB. It is cropped to a square.
          </p>

          {error && (
            <p role="alert" className="mt-1.5 text-[11.5px] font-bold text-red-600">
              {error}
            </p>
          )}
        </div>
      )}

      {confirmingRemove && (
        <Modal
          open
          onClose={() => (busy === null ? setConfirmingRemove(false) : undefined)}
          title="Remove your picture?"
          description="Your initials are shown instead. You can upload a new picture at any time."
          footer={
            <>
              <button
                type="button"
                onClick={() => setConfirmingRemove(false)}
                disabled={busy !== null}
                className="rounded-lg px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={confirmRemove}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {busy === 'remove' && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                <X className="h-4 w-4" aria-hidden="true" />
                Remove picture
              </button>
            </>
          }
        >
          <p className="text-[13px] leading-relaxed text-slate-600">
            This deletes the file we are holding for you. It cannot be undone from this screen.
          </p>
        </Modal>
      )}
    </div>
  );
};

export default AvatarUpload;
