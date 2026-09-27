"use client";

import UploadModal from "./UploadModal";
import { useEffect, useState } from "react";
import {
  Upload,
  Clock3,
  FolderGit2,
  ChevronRight,
  Loader2,
} from "lucide-react";

import { GithubIcon } from "./BrandIcons";
import { supabase } from "@/lib/supabase";

interface DashboardProps {
  userName?: string;
}

interface Project {
  id: string;
  name: string;
  source: "upload" | "github";
  created_at: string;
  last_accessed_at: string;
  repository_url: string | null;
}

export default function Dashboard({
  userName,
}: DashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("projects")
      .select(
        "id, name, source, created_at, last_accessed_at, repository_url"
      )
      .eq("user_id", user.id)
      .order("last_accessed_at", {
        ascending: false,
      });

    if (error) {
      console.error("Failed to load projects:", error);
      setLoading(false);
      return;
    }

    setProjects(data ?? []);
    setLoading(false);
  };

  const formatLastAccessed = (date: string) => {
    const difference =
      Date.now() - new Date(date).getTime();

    const minutes = Math.floor(
      difference / (1000 * 60)
    );

    const hours = Math.floor(
      difference / (1000 * 60 * 60)
    );

    const days = Math.floor(
      difference / (1000 * 60 * 60 * 24)
    );

    if (minutes < 1) {
      return "Just now";
    }

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    if (hours < 24) {
      return `${hours}h ago`;
    }

    if (days < 7) {
      return `${days}d ago`;
    }

    return new Date(date).toLocaleDateString();
  };

  const openProject = async (project: Project) => {
    await supabase
      .from("projects")
      .update({
        last_accessed_at: new Date().toISOString(),
      })
      .eq("id", project.id);

    // Editor navigation will be added later.
    console.log("Opening project:", project.id);
  };

  return (
    <main className="dashboard">

      {/* HISTORY */}

      <aside className="history-panel">

        <div className="history-header">
          <div>
            <span className="section-label">
              WORKSPACE
            </span>

            <h2>History</h2>
          </div>

          <Clock3 size={16} />
        </div>

        <div className="history-list">

          {loading ? (
            <div className="history-status">
              <Loader2
                size={16}
                className="spin"
              />

              <span>Loading...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="history-status">
              <FolderGit2 size={18} />

              <span>
                No projects yet
              </span>
            </div>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                className="history-item"
                onClick={() => openProject(project)}
              >
                <div className="history-item-main">

                  <FolderGit2
                    size={16}
                    strokeWidth={1.8}
                  />

                  <div className="history-info">
                    <strong>
                      {project.name}
                    </strong>

                    <span>
                      {formatLastAccessed(
                        project.last_accessed_at
                      )}
                    </span>
                  </div>

                </div>

                <ChevronRight
                  size={15}
                  className="history-arrow"
                />
              </button>
            ))
          )}

        </div>

      </aside>


      {/* MAIN WORKSPACE */}

      <section className="workspace-panel">

        <div className="workspace-heading">

          <span className="section-label">
            NEW PROJECT
          </span>

          <h1>
            {userName
              ? `What are you working on, ${
                  userName.split(" ")[0]
                }?`
              : "What are you working on?"}
          </h1>

          <p>
            Start a new analysis by uploading a project
            or connecting a GitHub repository.
          </p>

        </div>


        <div className="source-grid">

          {/* UPLOAD */}

          <button
            className="source-card"
            type="button"
            onClick={() => setUploadOpen(true)}
          >

            <div className="source-card-top">

              <div className="source-icon">
                <Upload
                  size={19}
                  strokeWidth={1.8}
                />
              </div>

              <ChevronRight
                size={17}
                className="source-arrow"
              />

            </div>

            <div className="source-content">

              <h3>
                Upload from device
              </h3>

              <p>
                Upload a ZIP containing your
                project files.
              </p>

            </div>

          </button>


          {/* GITHUB */}

          <button
            className="source-card"
            type="button"
            onClick={() => setUploadOpen(true)}
          >

            <div className="source-card-top">

              <div className="source-icon github-source">
                <GithubIcon className="github-icon" />
              </div>

              <ChevronRight
                size={17}
                className="source-arrow"
              />

            </div>

            <div className="source-content">

              <h3>
                Clone from GitHub
              </h3>

              <p>
                Import a repository using
                username/repository.
              </p>

            </div>

          </button>

        </div>


        <div className="upload-note">

          <div>
            <strong>
              100 MB project limit
            </strong>

            <span>
              Large dependency and environment
              directories are excluded automatically.
            </span>
          </div>

          <span className="ignored-files">
            node_modules · .venv · venv · .env · .git
          </span>

        </div>

      </section>

      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
        />
      )}

    </main>
  );
}