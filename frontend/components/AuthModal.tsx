"use client";

import { useState } from "react";
import {
  X,
  Mail,
  Lock,
  User,
  LogIn,
  Calendar,
  
} from "lucide-react";

import { GoogleIcon, GithubIcon } from "./BrandIcons";

import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

import { supabase } from "@/lib/supabase";

interface AuthModalProps {
  mode: "login" | "signup";
  onClose: () => void;
  onSwitch: (mode: "login" | "signup") => void;
}

export default function AuthModal({
  mode,
  onClose,
  onSwitch,
}: AuthModalProps) {
  const isSignup = mode === "signup";

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState<string | undefined>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const validateSignup = () => {
    if (!name.trim()) {
      return "Please enter your name.";
    }

    const numericAge = Number(age);

    if (!age || !Number.isInteger(numericAge)) {
      return "Please enter a valid age.";
    }

    if (numericAge < 13 || numericAge > 120) {
      return "Age must be between 13 and 120.";
    }

    if (!phone) {
      return "Please enter your phone number.";
    }

    if (password.length < 8) {
      return "Password must contain at least 8 characters.";
    }

    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter.";
    }

    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter.";
    }

    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number.";
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      return "Password must contain at least one special character.";
    }

    return null;
  };

  const handleSignup = async () => {
    setError("");
    setSuccess("");

    const validationError = validateSignup();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: name.trim(),
          age: Number(age),
          phone,
        },
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (data.session) {
      onClose();
      return;
    }

    setSuccess(
      "Account created! Please check your email to verify your account."
    );
  };

  const handleLogin = async () => {
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setError("Invalid email or password.");
      return;
    }

    onClose();
  };

  const handleGoogleLogin = async () => {
    setError("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setError(error.message);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="auth-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="auth-header">
          <div className="auth-icon">
            {isSignup ? <User size={24} /> : <LogInIcon />}
          </div>

          <h2>{isSignup ? "Create your account" : "Welcome back"}</h2>

          <p>
            {isSignup
              ? "Create an account to start analyzing your repositories."
              : "Login to continue to RepoAI."}
          </p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            {success}
          </div>
        )}

        {isSignup && (
          <>
            <div className="input-group">
              <label>Name</label>

              <div className="input-wrapper">
                <User size={18} />

                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group">
              <label>Age</label>

              <div className="input-wrapper">
                <Calendar size={18} />

                <input
                  type="number"
                  placeholder="Age"
                  min="13"
                  max="120"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group">
              <label>Phone number</label>

              <PhoneInput
                international
                defaultCountry="IN"
                value={phone}
                onChange={setPhone}
                placeholder="Enter phone number"
              />
            </div>
          </>
        )}

        <div className="input-group">
          <label>Email</label>

          <div className="input-wrapper">
            <Mail size={18} />

            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="input-group">
          <label>Password</label>

          <div className="input-wrapper">
            <Lock size={18} />

            <input
              type="password"
              placeholder={
                isSignup ? "Minimum 8 characters" : "Your password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        {isSignup && (
          <div className="password-hint">
            Password must contain 8+ characters, uppercase, lowercase,
            number and special character.
          </div>
        )}

        <button
          className="primary-auth-button"
          disabled={loading}
          onClick={isSignup ? handleSignup : handleLogin}
        >
          {loading
            ? "Please wait..."
            : isSignup
              ? "Create account"
              : "Login"}
        </button>

        <div className="divider">
          <span>OR</span>
        </div>

        <button
          className="google-button"
          onClick={handleGoogleLogin}
        >
          <GoogleIcon className="w-5 h-5 mr-2"/>
          Continue with Google
        </button>

        <div className="auth-switch">
          {isSignup
            ? "Already have an account?"
            : "Don't have an account?"}

          <button
            onClick={() =>
              onSwitch(isSignup ? "login" : "signup")
            }
          >
            {isSignup ? "Login" : "Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LogInIcon() {
  return <LogIn size={24} />;
}