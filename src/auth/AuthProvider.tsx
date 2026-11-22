import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth, firebaseEnabled, friendlyError } from "../lib/firebase";
import { demoStore } from "../store/demo";
import type { AppUser } from "../types";

/**
 * The sample workspace is a development aid only. Production builds always
 * authenticate against Firebase and store data in Cloud Firestore.
 */
const DEMO_ENABLED = import.meta.env.DEV;
const DEMO_SESSION_KEY = "finnova_demo_session";
const DEMO_USER: AppUser = {
  id: "demo-user",
  name: "Demo Explorer",
  email: "demo@finnova.app",
};

type AuthResult = { ok: true } | { ok: false; error: string };

interface AuthContextValue {
  user: AppUser | null;
  authReady: boolean;
  mode: "firebase" | "demo";
  isDemo: boolean;
  demoEnabled: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (name: string, email: string, password: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  startDemo: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function demoRequested(): boolean {
  if (!DEMO_ENABLED) return false;
  try {
    if (new URLSearchParams(window.location.search).get("demo") === "1") {
      // Persist so refreshes and deep links stay in the demo workspace.
      localStorage.setItem(DEMO_SESSION_KEY, "1");
      return true;
    }
    return localStorage.getItem(DEMO_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isDemo, setIsDemo] = useState<boolean>(() => demoRequested());
  const [user, setUser] = useState<AppUser | null>(() =>
    demoRequested() ? DEMO_USER : null,
  );
  const [authReady, setAuthReady] = useState<boolean>(() => !firebaseEnabled || demoRequested());
  // Holds the display name from signup until Firebase reports it back.
  const pendingName = useRef<string | null>(null);

  useEffect(() => {
    if (isDemo) return undefined;
    if (!firebaseEnabled || !auth) {
      setAuthReady(true);
      return undefined;
    }
    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(
        firebaseUser
          ? {
              id: firebaseUser.uid,
              name:
                firebaseUser.displayName ||
                pendingName.current ||
                firebaseUser.email ||
                "User",
              email: firebaseUser.email || "",
            }
          : null,
      );
      setAuthReady(true);
    });
  }, [isDemo]);

  const startDemo = useCallback(() => {
    if (!DEMO_ENABLED) return;
    try {
      localStorage.setItem(DEMO_SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    demoStore.ensure();
    setIsDemo(true);
    setUser(DEMO_USER);
    setAuthReady(true);
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!firebaseEnabled || !auth) {
        return { ok: false, error: "Firebase is not configured for this build." };
      }
      try {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: friendlyError(error) };
      }
    },
    [],
  );

  const signup = useCallback(
    async (name: string, email: string, password: string): Promise<AuthResult> => {
      if (!firebaseEnabled || !auth) {
        return { ok: false, error: "Firebase is not configured for this build." };
      }
      if (password.length < 6) {
        return { ok: false, error: "Please choose a password with at least 6 characters." };
      }
      try {
        pendingName.current = name.trim() || null;
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) {
          await updateProfile(credential.user, { displayName: name.trim() });
          setUser({
            id: credential.user.uid,
            name: name.trim(),
            email: credential.user.email || email.trim(),
          });
        }
        return { ok: true };
      } catch (error) {
        return { ok: false, error: friendlyError(error) };
      }
    },
    [],
  );

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    if (!firebaseEnabled || !auth) {
      return { ok: false, error: "Firebase is not configured." };
    }
    if (!email.trim()) {
      return { ok: false, error: "Enter your email address first, then tap “Forgot password”." };
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { ok: true };
    } catch (error) {
      return { ok: false, error: friendlyError(error) };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      localStorage.removeItem(DEMO_SESSION_KEY);
    } catch {
      /* ignore */
    }
    pendingName.current = null;
    setIsDemo(false);
    setUser(null);
    if (firebaseEnabled && auth && auth.currentUser) {
      try {
        await signOut(auth);
      } catch (cause) {
        // Offline sign-out still clears the local session; never leave the
        // button stuck on an unhandled rejection.
        console.warn("[FinNova] Sign out finished locally only:", cause);
      }
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      authReady,
      mode: isDemo ? "demo" : "firebase",
      isDemo,
      demoEnabled: DEMO_ENABLED,
      login,
      signup,
      resetPassword,
      logout,
      startDemo,
    }),
    [user, authReady, isDemo, login, signup, resetPassword, logout, startDemo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
