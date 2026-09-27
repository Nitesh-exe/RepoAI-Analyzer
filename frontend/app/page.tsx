"use client";

import { useEffect, useState } from "react";

import Navbar from "@/components/Navbar";
import AuthModal from "@/components/AuthModal";
import LandingPage from "@/components/LandingPage";
import Dashboard from "@/components/Dashboard";

import { supabase } from "@/lib/supabase";

type AuthMode = "login" | "signup" | null;

export default function Home() {
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setUser(session?.user ?? null);
      setLoading(false);
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name;

  return (
    <div className="app">
      <Navbar
        loggedIn={!!user}
        onLogin={() => setAuthMode("login")}
        onSignup={() => setAuthMode("signup")}
        onLogout={logout}
      />

      {user ? (
        <Dashboard userName={userName} />
      ) : (
        <LandingPage
          onLogin={() => setAuthMode("login")}
          onSignup={() => setAuthMode("signup")}
        />
      )}

      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onSwitch={setAuthMode}
        />
      )}
    </div>
  );
}