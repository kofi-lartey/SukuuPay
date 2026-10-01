import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImageOff, Trash2, UploadCloud } from 'lucide-react';
import { uploadStudentPhoto } from '../../services/upload';
import { updateStudent } from '../../services/students';
import StudentAvatar from './StudentAvatar';

/**
 * Fired after a photo write so the surfaces holding the row refetch. A photo
 * lives on the server the moment it uploads, but the roster, the drawer and the
 * alumni list each hold their own copy of the record — without this they keep
 * showing the old state until something else happens to reload them.
 */
export const PHOTO_CHANGED_EVENT = 'sukuupay:student-photo-changed';

/**
 * The photo section of the student form: upload, preview, replace, remove.
 *
 * **The validation here duplicates the server's on purpose.** `uploadStudentPhoto`
 * rejects anything that is not JPEG/PNG/WebP, anything over 2MB, and anything
 * under 200×200. Checking those in the browser first means the user finds out
 * from a field rather than from a toast after a round trip, and the constants
 * below are transcribed from `upload.service.js` — if that service's limits
 * change, these change with it or the form starts rejecting files the API would
 * have accepted (worse than not checking: it silently blocks valid uploads).
 *
 * **Create and edit are different problems.** The upload endpoint attaches a
 * photo to an *existing* student by id, so on create there is no id yet. The
 * chosen file is therefore held in state and uploaded immediately after the
 * create call returns, rather than being dropped or silently ignored.
 *
 * Removing a photo is a real write, not local state: the server is what holds
 * the URL, and clearing only the form would leave the old photo on the record
 * and reappear on the next load.
 */

/** From `upload.service.js`: allowedMimes, the 2MB ceiling, MIN_DIMENSION. */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;
const MIN_DIMENSION = 200;

export const ACCEPT = ALLOWED_TYPES.join(',');

/** @returns {string|null} an error message, or null when the file is usable. */
export const validatePhotoFile = (file) => {
  if (!file) return null;
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Use a JPG, PNG or WebP image.';
  }
  if (file.size > MAX_BYTES) {
    return `That image is ${(file.size / (1024 * 1024)).toFixed(1)}MB. The limit is 2MB.`;
  }
  return null;
};

/**
 * Dimension check, which needs the pixels decoded so it is necessarily async.
 *
 * The server enforces this too (`validateImageDimensions`), so this is a
 * courtesy that turns a 400 into an inline message — not a substitute. A 150px
 * image is the single most common failure for a photo taken on a cheap phone
 * and resized by whoever was told to "make it small", and the server's message
 * for it is not specific about which photo failed.
 */
const readDimensions = (file) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });

const StudentPhotoField = ({ student, pendingFile, onPendingFile, onError }) => {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const isEdit = Boolean(student?._id || student?.id);
  const savedImage = student?.studentImage || null;

  // The object URL is revoked when it is replaced and on unmount. Leaking one
  // per selection pins the whole decoded image in memory for the life of the
  // form, and reopening the dialog repeatedly is enough to matter.
  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const fail = (text) => {
    setMessage(text);
    onError?.(text);
  };

  const pick = async (file) => {
    setMessage(null);
    if (!file) return;

    const basic = validatePhotoFile(file);
    if (basic) {
      fail(basic);
      return;
    }

    const size = await readDimensions(file);
    if (!size) {
      fail('That file could not be read as an image.');
      return;
    }
    if (size.width < MIN_DIMENSION || size.height < MIN_DIMENSION) {
      fail(
        `That image is ${size.width}×${size.height}px. It must be at least ${MIN_DIMENSION}×${MIN_DIMENSION}px so it still prints clearly on a card.`
      );
      return;
    }

    if (!isEdit) {
      // No id yet — hold it and upload after the create call returns.
      onPendingFile(file);
      setMessage(null);
      return;
    }

    setBusy(true);
    try {
      await uploadStudentPhoto(file, student._id || student.id);
      setMessage(null);
      onError?.(null);
      window.dispatchEvent(new CustomEvent(PHOTO_CHANGED_EVENT));
    } catch (err) {
      fail(err.message || 'The photo could not be uploaded.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setMessage(null);
    if (!isEdit) {
      onPendingFile(null);
      return;
    }
    setBusy(true);
    try {
      // No dedicated un-set endpoint exists: `studentImage` is a plain
      // optional string on the update schema, so clearing it is an update with
      // an explicit null. Leaving it out would be a no-op that looks like it
      // worked.
      await updateStudent(student._id || student.id, { studentImage: null });
      window.dispatchEvent(new CustomEvent(PHOTO_CHANGED_EVENT));
    } catch (err) {
      fail(err.message || 'The photo could not be removed.');
    } finally {
      setBusy(false);
    }
  };

  const shown = previewUrl || savedImage;

  return (
    <fieldset className="rounded-xl border border-slate-200 p-4">
      <legend className="px-1 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
        Profile photo
      </legend>

      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          {shown ? (
            <span className="block h-20 w-20 overflow-hidden rounded-xl ring-1 ring-slate-200">
              <img
                src={shown}
                alt=""
                className="h-full w-full object-cover"
              />
            </span>
          ) : (
            <span className="block h-20 w-20 rounded-xl bg-slate-50 ring-1 ring-slate-200">
              <StudentAvatar student={student} size="xl" className="!h-20 !w-20 !rounded-xl !text-xl" />
            </span>
          )}

          {busy && (
            <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-700" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-slate-500">
            Used on ID cards, printed rosters and fee reminders. A square,
            front-facing photo with a clear background works best.
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={(event) => {
                pick(event.target.files?.[0]);
                // Cleared so re-picking the same file fires `change` again —
                // otherwise choosing the same photo twice silently does nothing,
                // which reads as "the upload is broken".
                event.target.value = '';
              }}
            />

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {shown ? <Camera className="h-3.5 w-3.5" aria-hidden="true" /> : <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />}
              {shown ? 'Replace photo' : 'Upload photo'}
            </button>

            {(shown || pendingFile) && (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-extrabold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Remove
              </button>
            )}

            {!shown && !busy && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                <ImageOff className="h-3.5 w-3.5" aria-hidden="true" />
                Optional
              </span>
            )}
          </div>

          {message && (
            <p className="mt-2 text-[12px] font-semibold text-red-700">{message}</p>
          )}

          {pendingFile && !message && (
            <p className="mt-2 text-[12px] font-semibold text-slate-500">
              Uploads once the student is saved.
            </p>
          )}
        </div>
      </div>
    </fieldset>
  );
};

export default StudentPhotoField;
