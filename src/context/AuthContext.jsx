import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import {
  onAuthChange,
  login as apiLogin,
  studentLogin as apiStudentLogin,
  signup as apiSignup,
  signOutUser as apiSignOut,
  getCurrentUser,
  clearTokens,
} from '../services/auth';
import { updateMe } from '../services/user';
import { joinsSchoolByCode } from '../utils/constants';

const AuthContext = createContext();

/**
 * Offline fallback for the onboarding completion flag.
 *
 * The durable record is `User.onboardingCompleted` on the server — it is what
 * makes the wizard follow a bursar to a second device. This key remains only as
 * a backstop for the window between "the wizard finished" and "the PATCH landed",
 * and for a first paint before `/auth/me` has answered.
 *
 * It was the *only* record before this change, which meant an admin who onboarded
 * on a laptop walked the wizard again on their phone. Harmless when re-running
 * meant re-entering details; no longer harmless now that Step 1 creates a school.
 */
const ONBOARDING_FLAG_KEY = 'sukuupay_onboarding_completed';

const readOnboardingFlag = (userId) =>
  userId ? localStorage.getItem(`${ONBOARDING_FLAG_KEY}_${userId}`) === 'true' : false;

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * The server's answer to "is this account linked to a school?".
 *
 * Deliberately not recomputed here. The client used to infer it from
 * `schoolId === null`, which is why an unlinked account could only ever be shown
 * an error: there was no second branch to take. The server knows things the
 * client cannot — that `super_admin` legitimately has no school, and that a
 * `schoolId` can point at an archived school — so it reports the resolved state
 * and this provider passes it through untouched.
 *
 * Shape (see `onboardingBlock` in the auth controller):
 *   { linked, reason, schoolId, completed, highestStep, nextRoute,
 *     flow, joinRequested, joinRequest }
 *
 * `flow` is `'wizard'` or `'join'`: the two onboarding flows the server tells
 * apart by role. `joinRequest` is the live pending request for join-flow
 * accounts, or null.
 */
const UNKNOWN_LINK_STATE = {
  linked: false,
  reason: 'UNKNOWN',
  schoolId: null,
  completed: false,
  highestStep: 0,
  nextRoute: null,
  flow: null,
  joinRequested: false,
  joinRequest: null,
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState(UNKNOWN_LINK_STATE);
  const [school, setSchool] = useState(null);

  // Re-derive whenever the identity changes, so signing out of a school admin
  // and into another one does not inherit the first one's state.
  useEffect(() => {
    if (!user) {
      setOnboarding(UNKNOWN_LINK_STATE);
      setSchool(null);
      return;
    }

    setOnboarding((current) => ({
      ...current,
      // The API is authoritative. The localStorage read only fills the gap while
      // the server says nothing, so a cleared flag can never strand a bursar in
      // the wizard after the server confirmed they finished.
      //
      // `||`, not `=`, and the difference is the join flow: an accountant or
      // teacher approved into a school has `onboardingCompleted === false`
      // forever, because the wizard was never theirs to complete. Recomputing
      // this field from that flag on every render would un-finish them, and the
      // guard would bounce an approved teacher back into onboarding on each
      // reload. Once finished — by the server or by the backstop — it stays
      // finished for the rest of the session.
      completed:
        current.completed ||
        user.onboardingCompleted === true ||
        (!joinsSchoolByCode(user?.role) && readOnboardingFlag(user?._id)),
      highestStep: user.onboardingHighestStep ?? current.highestStep ?? 0,
    }));
  }, [user?._id, user?.onboardingCompleted, user?.onboardingHighestStep]);

  /**
   * Folds a fresh `/auth/me` response into state.
   *
   * `linkState` and `nextRoute` are read off the response rather than derived,
   * so the guard and Step 1 branch on exactly what the server decided.
   */
  const applySession = useCallback((userData, linkState) => {
    setUser(userData ?? null);
    if (!userData) {
      setOnboarding(UNKNOWN_LINK_STATE);
      return;
    }
    setOnboarding({
      ...UNKNOWN_LINK_STATE,
      ...(linkState || {}),
      linked: linkState?.linked ?? Boolean(userData.schoolId),
      // The server's `completed` wins where it speaks, because it answers for
      // both flows: a wizard role has to have finished the steps, a join role
      // has to have been approved. The local fallback covers only the window
      // before the server has answered.
      completed:
        linkState?.completed ??
        (userData.onboardingCompleted === true ||
          (!joinsSchoolByCode(userData?.role) && readOnboardingFlag(userData._id))),
      highestStep: userData.onboardingHighestStep ?? 0,
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (token === 'student-demo-token') {
        const studentId = localStorage.getItem('student_demo_id') || 'Student';
        const mockUser = { _id: studentId, name: studentId, role: 'student', studentId, onboardingCompleted: true };
        if (mounted) applySession(mockUser, { linked: true, completed: true });
        if (mounted) setLoading(false);
        return;
      }
      if (token) {
        try {
          const session = await getCurrentUser();
          if (mounted) applySession(session.user, session.onboarding);
        } catch (error) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          if (mounted) applySession(null);
        }
      }
      if (mounted) setLoading(false);
    };

    checkAuth();

    const unsubscribe = onAuthChange((session) => {
      // `onAuthChange` now emits the whole session envelope, so the link state
      // arrives with the identity instead of being refetched.
      applySession(session?.user ?? null, session?.onboarding);
      setLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [applySession]);

  const login = async (email, password) => {
    clearTokens();
    const { user: signedIn, onboarding: linkState, message } = await apiLogin(email, password);
    applySession(signedIn, linkState);
    return { user: signedIn, onboarding: linkState, message };
  };

  const studentLogin = useCallback(async (studentId, password) => {
    clearTokens();
    const { user: signedIn, onboarding: linkState } = await apiStudentLogin(studentId, password);
    applySession(signedIn, linkState);
    return { user: signedIn, onboarding: linkState };
  }, [applySession]);

  const signup = async (payload) => {
    const result = await apiSignup(payload);
    // The API issues no session on signup, so the user stays signed out until
    // they verify their email and log in.
    applySession(null);
    return result;
  };

  const logout = useCallback(async () => {
    localStorage.removeItem('student_demo_id');
    await apiSignOut();
    applySession(null);
  }, [applySession]);

  const clearSession = useCallback(() => {
    clearTokens();
    applySession(null);
  }, [applySession]);

  /**
   * Re-reads `/auth/me` and replaces the cached identity.
   *
   * Needed after provisioning: `POST /schools/me` returns the linked user, but
   * the guard, the stepper and every later step all read `user.schoolId`, so
   * one authoritative refresh is cheaper than patching three call sites and
   * hoping they stay in step.
   */
  const refreshUser = useCallback(async () => {
    const session = await getCurrentUser();
    applySession(session.user, session.onboarding);
    if (session.onboarding?.linked && session.onboarding.schoolId) {
      setSchool((current) => current ?? null);
    }
    return session.user;
  }, [applySession]);

  /**
   * Replaces the cached user in place.
   *
   * `POST /schools/me` already returns the updated user, so a second network
   * round trip to learn a `schoolId` this response contains would be waste.
   */
  const applyUser = useCallback((nextUser, linkState) => {
    applySession(nextUser ?? user, linkState);
  }, [applySession, user]);

  /**
   * Marks the wizard as finished, server-side first.
   *
   * `updateMe` is awaited but a failure is swallowed: a bursar must not be
   * stranded on step 4 because a PATCH was rejected, and the local flag keeps
   * them out of the wizard on this device either way. Never throws.
   */
  const markOnboardingComplete = useCallback(async () => {
    const userId = user?._id;
    if (!userId) return;

    localStorage.setItem(`${ONBOARDING_FLAG_KEY}_${userId}`, 'true');
    setOnboarding((current) => ({ ...current, completed: true }));

    try {
      const updated = await updateMe(userId, { onboardingCompleted: true });
      if (updated?.onboardingCompleted !== undefined) {
        setOnboarding((current) => ({ ...current, completed: updated.onboardingCompleted }));
      }
    } catch {
      // Deliberately ignored — see above.
    }
  }, [user?._id]);

  /**
   * Records how far the wizard has been unlocked.
   *
   * Best-effort and never awaited by callers: it exists so a refresh on a second
   * device resumes at the right step, and losing that is not worth blocking
   * navigation for.
   */
  const saveOnboardingStep = useCallback(
    (step) => {
      const userId = user?._id;
      if (!userId) return;
      setOnboarding((current) =>
        current.highestStep >= step ? current : { ...current, highestStep: step }
      );
      updateMe(userId, { onboardingHighestStep: step }).catch(() => {});
    },
    [user?._id]
  );

  /**
   * True when this account has to create a school before it can do anything.
   *
   * This is the flag that replaces the dead end. A user who reaches it is not
   * stuck — they are one step away from having a school, and Step 1 renders the
   * form that creates it.
   */
  const needsSchoolProvisioning =
    Boolean(user) && onboarding.linked === false && user.role !== 'super_admin';

  const value = {
    user,
    school,
    setSchool,
    onboarding,
    linkState: onboarding,
    needsSchoolProvisioning,
    login,
    studentLogin,
    signup,
    logout,
    clearSession,
    loading,
    onboardingCompleted: onboarding.completed,
    markOnboardingComplete,
    saveOnboardingStep,
    refreshUser,
    applyUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
