"use client";

import {
  Upload,

  Clock3,
  FolderGit2,
  ArrowRight,
} from "lucide-react";

import { GithubIcon } from "./BrandIcons";

interface DashboardProps {
  userName?: string;
}

const history = [
  {
    name: "RepoAI Analyzer",
    date: "5 minutes ago",
  },
  {
    name: "SentinelMesh",
    date: "2 hours ago",
  },
  {
    name: "E-Commerce Microservices",
    date: "2 days ago",
  },
];

export default function Dashboard({
  userName,
}: DashboardProps) {
  return (
    <main className="dashboard">
      <aside className="history-panel">
        <div className="history-header">
          <div>
            <span className="section-label">YOUR WORKSPACE</span>
            <h2>History</h2>
          </div>

          <Clock3 size={19} />
        </div>

        <div className="history-list">
          {history.map((project) => (
            <button
              className="history-item"
              key={project.name}
            >
              <div className="history-icon">
                <FolderGit2 size={18} />
              </div>

              <div className="history-info">
                <strong>{project.name}</strong>
                <span>{project.date}</span>
              </div>

              <ArrowRight size={16} />
            </button>
          ))}
        </div>
      </aside>

      <section className="workspace-panel">
        <div className="workspace-heading">
          <span className="section-label">NEW PROJECT</span>

          <h1>
            {userName
              ? `What are you working on, ${userName.split(" ")[0]}?`
              : "What are you working on?"}
          </h1>

          <p>
            Start a new analysis by uploading a project or
            connecting a GitHub repository.
          </p>
        </div>

        <div className="source-grid">
          <button className="source-card">
            <div className="source-icon">
              <Upload />
            </div>

            <div>
              <h3>Upload from device</h3>

              <p>
                Upload a ZIP containing your project.
              </p>
            </div>

            <ArrowRight className="source-arrow" />
          </button>

          <button className="source-card">
            <div className="source-icon github-source">
              <GithubIcon className="w-5 h-5 mr-2"/>
            </div>

            <div>
              <h3>Clone from GitHub</h3>

              <p>
                Enter a GitHub repository and clone it.
              </p>
            </div>

            <ArrowRight className="source-arrow" />
          </button>
        </div>

        <div className="upload-note">
          <strong>100 MB project limit</strong>

          <span>
            Files such as node_modules, .venv, venv and .env
            will be excluded automatically.
          </span>
        </div>
      </section>
    </main>
  );
}