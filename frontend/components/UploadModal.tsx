"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  X,
  FileArchive,
  Check,
  AlertCircle,
  Loader2,
  FolderGit2,
  ExternalLink,
} from "lucide-react";
import { GithubIcon } from "./BrandIcons";
import { supabase } from "@/lib/supabase";

interface UploadModalProps {
  onClose: () => void;
  initialMode?: "upload" | "github";
}

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function UploadModal({
  onClose,
  initialMode = "upload",
}: UploadModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"upload" | "github">(initialMode);
  const [file, setFile] = useState<File | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const validateFile = (selectedFile: File) => {
    setError("");

    const isZip =
      selectedFile.name.toLowerCase().endsWith(".zip") ||
      selectedFile.type === "application/zip" ||
      selectedFile.type === "application/x-zip-compressed";

    if (!isZip) {
      setFile(null);
      setError("Only ZIP archives are supported.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setError("The project ZIP must be smaller than 100 MB.");
      return;
    }

    setFile(selectedFile);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      validateFile(selectedFile);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
      validateFile(droppedFile);
    }
  };

  const handleUploadZip = async () => {
    if (!file) return;
    setError("");
    setLoading(true);
    setLoadingMessage("Extracting and saving files...");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${BACKEND_URL}/api/projects/upload/`, {
        method: "POST",
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to upload project.");
        setLoading(false);
        return;
      }

      onClose();
      if (data.project?.id) {
        router.push(`/editor?project=${data.project.id}`);
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      setError("Unable to connect to the backend server.");
      setLoading(false);
    }
  };

  const handleCloneGithub = async () => {
    if (!githubUrl.trim()) {
      setError("Please enter a valid GitHub repository URL or 'owner/repo'.");
      return;
    }

    setError("");
    setLoading(true);
    setLoadingMessage("Cloning repository from GitHub...");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${BACKEND_URL}/api/projects/github/`, {
        method: "POST",
        headers,
        body: JSON.stringify({ repository_url: githubUrl.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to clone repository.");
        setLoading(false);
        return;
      }

      onClose();
      if (data.project?.id) {
        router.push(`/editor?project=${data.project.id}`);
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      setError("Unable to connect to the backend server.");
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="upload-modal"
        style={{ maxWidth: 540 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="upload-modal-header">
          <div>
            <span className="section-label">NEW PROJECT</span>
            <h2>{mode === "upload" ? "Upload Project" : "Clone from GitHub"}</h2>
            <p>
              {mode === "upload"
                ? "Upload a ZIP file of your codebase to start analyzing."
                : "Import any public repository directly into your workspace."}
            </p>
          </div>

          <button className="modal-close" onClick={onClose} type="button" disabled={loading}>
            <X size={18} />
          </button>
        </div>

        {/* MODE TABS */}
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "4px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("upload");
              setError("");
            }}
            disabled={loading}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              background: mode === "upload" ? "var(--accent)" : "transparent",
              color: mode === "upload" ? "#fff" : "var(--muted)",
              border: "none",
              transition: "all 0.2s ease",
            }}
          >
            <Upload size={15} />
            Upload ZIP
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("github");
              setError("");
            }}
            disabled={loading}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              background: mode === "github" ? "var(--accent)" : "transparent",
              color: mode === "github" ? "#fff" : "var(--muted)",
              border: "none",
              transition: "all 0.2s ease",
            }}
          >
            <FolderGit2 size={15} />
            GitHub Clone
          </button>
        </div>

        {/* UPLOAD FORM */}
        {mode === "upload" ? (
          <>
            {!file ? (
              <div
                className={`drop-zone ${dragging ? "drop-zone-active" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => !loading && inputRef.current?.click()}
                style={{ cursor: loading ? "not-allowed" : "pointer" }}
              >
                <div className="drop-icon">
                  <Upload size={20} strokeWidth={1.8} />
                </div>
                <strong>Drop your project ZIP here</strong>
                <span>or click to browse your device</span>
                <small>ZIP files only · Maximum 100 MB</small>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".zip,application/zip"
                  hidden
                  onChange={handleFileChange}
                />
              </div>
            ) : (
              <div className="selected-file">
                <div className="selected-file-icon">
                  <FileArchive size={19} />
                </div>
                <div className="selected-file-info">
                  <strong>{file.name}</strong>
                  <span>{formatFileSize(file.size)}</span>
                </div>
                <div className="file-valid">
                  <Check size={15} />
                </div>
                <button
                  type="button"
                  className="remove-file"
                  disabled={loading}
                  onClick={() => {
                    setFile(null);
                    setError("");
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            )}
          </>
        ) : (
          /* GITHUB FORM */
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)" }}>
                Repository URL or Owner/Repository
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0 12px",
                  gap: 10,
                }}
              >
                <GithubIcon className="github-icon" style={{ width: 18, height: 18, opacity: 0.7 }} />
                <input
                  type="text"
                  placeholder="https://github.com/facebook/react or vercel/next.js"
                  value={githubUrl}
                  disabled={loading}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCloneGithub()}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    padding: "12px 0",
                    color: "var(--text)",
                    outline: "none",
                    fontSize: 13,
                  }}
                />
              </div>
              <span style={{ fontSize: 11, color: "var(--muted)", opacity: 0.8 }}>
                Accepts full GitHub URL or simple owner/repo notation
              </span>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                padding: "8px 0",
              }}
            >
              <span style={{ fontSize: 11, color: "var(--muted)" }}>Quick examples:</span>
              {["pallets/flask", "shadcn-ui/ui", "facebook/react"].map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setGithubUrl(example)}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontSize: 11,
                    color: "var(--muted)",
                  }}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ERROR MESSAGE */}
        {error && (
          <div className="upload-error" style={{ marginTop: 14 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* LOADING INDICATOR */}
        {loading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 16px",
              background: "rgba(124, 92, 255, 0.1)",
              border: "1px solid rgba(124, 92, 255, 0.25)",
              borderRadius: 8,
              marginTop: 14,
            }}
          >
            <Loader2 size={16} className="spin" style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: 12, color: "var(--text)" }}>{loadingMessage}</span>
          </div>
        )}

        {/* INFO FOOTER */}
        <div className="upload-info" style={{ marginTop: 16 }}>
          <div>
            <strong>Automated Clean Up</strong>
            <span>
              Directories such as node_modules, .git, .env, venv, and .next are automatically excluded.
            </span>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="upload-actions" style={{ marginTop: 18 }}>
          <button
            type="button"
            className="cancel-button"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>

          {mode === "upload" ? (
            <button
              type="button"
              className="upload-button"
              disabled={!file || loading}
              onClick={handleUploadZip}
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={15} />
                  Upload Project
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              className="upload-button"
              disabled={!githubUrl.trim() || loading}
              onClick={handleCloneGithub}
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="spin" />
                  Cloning...
                </>
              ) : (
                <>
                  <FolderGit2 size={15} />
                  Clone & Open
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}