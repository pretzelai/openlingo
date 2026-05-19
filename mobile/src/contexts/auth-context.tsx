import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import {
  getSession,
  signIn as apiSignIn,
  signUp as apiSignUp,
  signOut as apiSignOut,
  getApiUrl,
  setApiUrl,
  getSessionToken,
} from "@/lib/api";
import type { User, AuthSession } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  configureServer: (url: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  const refreshSession = useCallback(async () => {
    try {
      const session = await getSession();
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const apiUrl = await getApiUrl();
        if (apiUrl) {
          setIsConfigured(true);
          const token = await getSessionToken();
          if (token) {
            await refreshSession();
          }
        }
      } catch {
        // Ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refreshSession]);

  const configureServer = async (url: string) => {
    await setApiUrl(url);
    setIsConfigured(true);
  };

  const signIn = async (email: string, password: string) => {
    const result = await apiSignIn(email, password);
    if (result?.user) {
      setUser(result.user);
    } else {
      // Try fetching session after sign-in
      await refreshSession();
    }
  };

  const signUp = async (name: string, email: string, password: string) => {
    const result = await apiSignUp(name, email, password);
    if (result?.user) {
      setUser(result.user);
    } else {
      await refreshSession();
    }
  };

  const signOut = async () => {
    await apiSignOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isConfigured,
        signIn,
        signUp,
        signOut,
        refreshSession,
        configureServer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
