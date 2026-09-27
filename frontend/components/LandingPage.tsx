"use client";

import {
 
  Upload,
  ArrowRight,
  ShieldCheck,
  Zap,
  Code2,
} from "lucide-react";

import { GithubIcon } from "./BrandIcons";

interface LandingPageProps {
  onSignup: () => void;
  onLogin: () => void;
}

export default function LandingPage({
  onSignup,
  onLogin,
}: LandingPageProps) {
  return (
    <main>
      <section className="hero" id="home">
        <div className="hero-badge">
          <Code2 size={15} />
          AI-powered codebase analysis
        </div>

        <h1>
          Understand your
          <span> codebase.</span>
        </h1>

        <p>
          Upload a project or connect a GitHub repository and let
          RepoAI analyze your codebase, structure, dependencies and
          architecture.
        </p>

        <div className="hero-actions">
          <button
            className="hero-primary"
            onClick={onSignup}
          >
            Get started
            <ArrowRight size={18} />
          </button>

          <button
            className="hero-secondary"
            onClick={onLogin}
          >
            Login
          </button>
        </div>
      </section>

      <section className="about-section" id="about">
        <div className="section-label">ABOUT REPOAI</div>

        <h2>
          Your codebase,
          <br />
          explained.
        </h2>

        <p className="section-description">
          RepoAI is designed to help developers understand unfamiliar
          repositories without spending hours manually navigating
          through files.
        </p>

        <div className="feature-grid">
          <Feature
            icon={<Upload />}
            title="Upload your project"
            description="Upload a project archive directly from your device."
          />

          <Feature
            icon=<GithubIcon className="w-5 h-5 mr-2"/>
            title="Connect GitHub"
            description="Clone a public GitHub repository and start analyzing it."
          />

          <Feature
            icon={<Zap />}
            title="Fast analysis"
            description="Turn a large codebase into understandable information."
          />

          <Feature
            icon={<ShieldCheck />}
            title="Your projects"
            description="Keep your previous analysis sessions organized in one place."
          />
        </div>
      </section>

      <section className="how-section">
        <div className="section-label">HOW IT WORKS</div>

        <h2>Three simple steps.</h2>

        <div className="steps">
          <Step
            number="01"
            title="Create an account"
            description="Sign up and access your personal project workspace."
          />

          <Step
            number="02"
            title="Add your repository"
            description="Upload a project or clone it directly from GitHub."
          />

          <Step
            number="03"
            title="Explore your code"
            description="Open your project and understand its structure."
          />
        </div>
      </section>

      <section className="cta-section">
        <h2>Ready to understand your codebase?</h2>

        <p>
          Create your account and start your first project.
        </p>

        <button
          className="hero-primary"
          onClick={onSignup}
        >
          Create account
          <ArrowRight size={18} />
        </button>
      </section>
    </main>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="feature-card">
      <div className="feature-icon">
        {icon}
      </div>

      <h3>{title}</h3>

      <p>{description}</p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="step">
      <span>{number}</span>

      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}