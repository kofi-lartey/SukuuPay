import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import {
  onAuthChange,
  login as apiLogin,
  signup as apiSignup,
  signOutUser as apiSignOut,
  getCurrentUser,
} from '../services/auth';
import { updateMe } from '../services/user';

const AuthContext = createContext();

/**
 * Local record of a finished onboarding wizard.
 *
 * The User model has no `onboardingCompleted` field and there is no
 * `PUT /users/me` route, so the flag lives in localStorage. Keyed by user id so
 * two accounts on one browser do not share it.
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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  // Re-read the flag whenever the identity changes, so signing out of a school
  // admin and into another one does not inherit the first one's state.
  useEffect(() => {
    setOnboardingCompleted(readOnboardingFlag(user?._id));
  }, [user?._id]);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const userData = await getCurrentUser();
          if (mounted) setUser(userData);
        } catch (error) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          if (mounted) setUser(null);
        }
      }
      if (mounted) setLoading(false);
    };

    checkAuth();

    const unsubscribe = onAuthChange((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const { user: signedIn, message } = await apiLogin(email, password);
    setUser(signedIn);
    return { user: signedIn, message };
  };

  const signup = async (payload) => {
    const result = await apiSignup(payload);
    // The API issues no session on signup, so the user stays signed out until
    // they verify their email and log in.
    setUser(null);
    return result;
  };

  const logout = useCallback(async () => {
    await apiSignOut();
    setUser(null);
    setOnboardingCompleted(false);
  }, []);

  /**
   * Marks the wizard as finished.
   *
   * `updateMe` is attempted so a server-side field can take over the moment the
   * backend supports one, but a failure is swallowed: the durable record is the
   * local flag, and a bursar must not be stranded on step 4 because a profile
   * PATCH was rejected. Never throws.
   */
  const markOnboardingComplete = useCallback(async () => {
    const userId = user?._id;
    if (userId) {
      localStorage.setItem(`${ONBOARDING_FLAG_KEY}_${userId}`, 'true');
      setOnboardingCompleted(true);
    }
    if (!userId) return;
    try {
      await updateMe(userId, { onboardingCompleted: true });
    } catch {
      // Deliberately ignored — see above.
    }
  }, [user?._id]);

  const value = { user, login, signup, logout, loading, onboardingCompleted, markOnboardingComplete };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};