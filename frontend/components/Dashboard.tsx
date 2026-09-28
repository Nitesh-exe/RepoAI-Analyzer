"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Clock3,
  FolderGit2,
  ChevronRight,
  Loader2,
  Trash2,
  ExternalLink,
} from "lucide-react";
import UploadModal from "./UploadModal";
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

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function Dashboard({ userName }: DashboardProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"upload" | "github">("upload");
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      .select("id, name, source, created_at, last_accessed_at, repository_url")
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
    const difference = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(difference / (1000 * 60));
    const hours = Math.floor(difference / (1000 * 60 * 60));
    const days = Math.floor(difference / (1000 * 60 * 60 * 24));

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  const openProject = async (project: Project) => {
    try {
      await supabase
        .from("projects")
        .update({
          last_accessed_at: new Date().toISOString(),
        })
        .eq("id", project.id);
    } catch (e) {
      console.warn("Could not update last_accessed_at:", e);
    }

    router.push(`/editor?project=${project.id}`);
  };

  const deleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project?")) return;

    setDeletingId(projectId);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Delete from backend storage
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      await fetch(`${BACKEND_URL}/api/projects/${projectId}/`, {
        method: "DELETE",
        headers,
      });

      // Also ensure deleted from Supabase
      await supabase.from("projects").delete().eq("id", projectId);

      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error("Failed to delete project:", err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="dashboard">
      {/* HISTORY PANEL */}
      <aside className="history-panel">
        <div className="history-header">
          <div>
            <span className="section-label">WORKSPACE</span>
            <h2>History</h2>
          </div>
          <Clock3 size={16} />
        </div>

        <div className="history-list">
          {loading ? (
            <div className="history-status">
              <Loader2 size={16} className="spin" />
              <span>Loading projects...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="history-status">
              <FolderGit2 size={18} />
              <span>No projects yet</span>
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                className="history-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
                onClick={() => openProject(project)}
              >
                <div className="history-item-main" style={{ flex: 1, minWidth: 0 }}>
                  {project.source === "github" ? (
                    <GithubIcon style={{ width: 16, height: 16, flexShrink: 0, opacity: 0.85 }} />
                  ) : (
                    <FolderGit2 size={16} strokeWidth={1.8} style={{ flexShrink: 0 }} />
                  )}

                  <div className="history-info" style={{ overflow: "hidden" }}>
                    <strong style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      {project.name}
                    </strong>
                    <span>{formatLastAccessed(project.last_accessed_at)}</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    type="button"
                    title="Delete project"
                    onClick={(e) => deleteProject(e, project.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--muted)",
                      padding: 4,
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#ff5c5c")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
                  >
                    {deletingId === project.id ? (
                      <Loader2 size={13} className="spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>

                  <ChevronRight size={15} className="history-arrow" />
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* MAIN WORKSPACE PANEL */}
      <section className="workspace-panel">
        <div className="workspace-heading">
          <span className="section-label">NEW PROJECT</span>
          <h1>
            {userName
              ? `What are you working on, ${userName.split(" ")[0]}?`
              : "What are you working on?"}
          </h1>
          <p>
            Start a new analysis by uploading a project or importing a GitHub repository.
          </p>
        </div>

        <div className="source-grid">
          {/* UPLOAD FROM DEVICE */}
          <button
            className="source-card"
            type="button"
            onClick={() => {
              setModalMode("upload");
              setUploadOpen(true);
            }}
          >
            <div className="source-card-top">
              <div className="source-icon">
                <Upload size={19} strokeWidth={1.8} />
              </div>
              <ChevronRight size={17} className="source-arrow" />
            </div>

            <div className="source-content">
              <h3>Upload from device</h3>
              <p>Upload a ZIP archive containing your project files.</p>
            </div>
          </button>

          {/* CLONE FROM GITHUB */}
          <button
            className="source-card"
            type="button"
            onClick={() => {
              setModalMode("github");
              setUploadOpen(true);
            }}
          >
            <div className="source-card-top">
              <div className="source-icon github-source">
                <GithubIcon className="github-icon" />
              </div>
              <ChevronRight size={17} className="source-arrow" />
            </div>

            <div className="source-content">
              <h3>Clone from GitHub</h3>
              <p>Import any public repository using username/repository or URL.</p>
            </div>
          </button>
        </div>

        <div className="upload-note">
          <div>
            <strong>100 MB project limit</strong>
            <span>
              Large dependency and build directories are excluded automatically.
            </span>
          </div>

          <span className="ignored-files">
            node_modules · .venv · venv · .env · .git · dist · build
          </span>
        </div>
      </section>

      {uploadOpen && (
        <UploadModal
          initialMode={modalMode}
          onClose={() => setUploadOpen(false)}
        />
      )}
    </main>
  );
}