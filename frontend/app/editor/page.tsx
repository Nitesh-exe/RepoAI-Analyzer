"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  FolderGit2,
  ExternalLink,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Layers,
  Code2,
} from "lucide-react";
import { GithubIcon } from "@/components/BrandIcons";
import FileTree, { FileItem } from "@/components/editor/FileTree";
import CodeViewer, { OpenFileTab } from "@/components/editor/CodeViewer";
import AiAgentPanel from "@/components/editor/AiAgentPanel";
import { supabase } from "@/lib/supabase";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");

  const [projectData, setProjectData] = useState<any>(null);
  const [tree, setTree] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor Tabs State
  const [openTabs, setOpenTabs] = useState<OpenFileTab[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | undefined>(undefined);

  // Layout Panels Visibility
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  // Triggered prompt for AI Agent
  const [triggeredPrompt, setTriggeredPrompt] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!projectId) {
      setError("No project specified.");
      setLoading(false);
      return;
    }

    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      // Fetch Tree
      const treeRes = await fetch(`${BACKEND_URL}/api/projects/${projectId}/tree/`, {
        headers,
      });

      if (!treeRes.ok) {
        const treeErr = await treeRes.json().catch(() => ({}));
        throw new Error(treeErr.error || "Failed to load project file tree.");
      }

      const treeData = await treeRes.json();
      setTree(treeData.tree || []);

      // Fetch Project Details
      const detailRes = await fetch(`${BACKEND_URL}/api/projects/${projectId}/`, {
        headers,
      });

      if (detailRes.ok) {
        const detailData = await detailRes.json();
        setProjectData(detailData.project);
      }

      // Auto-open README.md or package.json or main file if available
      const defaultFile = findDefaultFile(treeData.tree || []);
      if (defaultFile) {
        openFile(defaultFile);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load project.");
    } finally {
      setLoading(false);
    }
  };

  const findDefaultFile = (items: FileItem[]): string | null => {
    for (const item of items) {
      if (item.type === "file") {
        const lower = item.name.toLowerCase();
        if (lower.startsWith("readme") || lower === "package.json" || lower === "main.py") {
          return item.path;
        }
      }
    }
    // First file found
    for (const item of items) {
      if (item.type === "file") return item.path;
      if (item.children) {
        const nested = findDefaultFile(item.children);
        if (nested) return nested;
      }
    }
    return null;
  };

  const openFile = async (path: string) => {
    // If already open in tabs
    const existing = openTabs.find((t) => t.path === path);
    if (existing) {
      setActiveFilePath(path);
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(
        `${BACKEND_URL}/api/projects/${projectId}/file/?path=${encodeURIComponent(path)}`,
        { headers }
      );

      if (!res.ok) {
        throw new Error("Failed to load file content.");
      }

      const fileData = await res.json();
      const newTab: OpenFileTab = {
        path: fileData.path,
        name: fileData.name,
        extension: fileData.extension,
        content: fileData.content,
        lines_count: fileData.lines_count,
        size_bytes: fileData.size_bytes,
      };

      setOpenTabs((prev) => [...prev, newTab]);
      setActiveFilePath(path);
    } catch (err) {
      console.error("Error opening file:", err);
    }
  };

  const closeTab = (path: string) => {
    setOpenTabs((prev) => {
      const remaining = prev.filter((t) => t.path !== path);
      if (activeFilePath === path) {
        const nextActive = remaining.length > 0 ? remaining[remaining.length - 1].path : undefined;
        setActiveFilePath(nextActive);
      }
      return remaining;
    });
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "var(--background)",
          color: "var(--text)",
          gap: 16,
        }}
      >
        <Loader2 size={32} className="spin" style={{ color: "var(--accent)" }} />
        <span style={{ fontSize: 14, color: "var(--muted)" }}>
          Loading workspace and project files...
        </span>
      </div>
    );
  }

  if (error || !projectId) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "var(--background)",
          color: "var(--text)",
          padding: 24,
          textAlign: "center",
          gap: 16,
        }}
      >
        <h2 style={{ fontSize: 18, color: "#f87171" }}>Workspace Error</h2>
        <p style={{ fontSize: 13, color: "var(--muted)", maxWidth: 420 }}>
          {error || "Project could not be found or access was denied."}
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            background: "var(--accent)",
            color: "#ffffff",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={15} />
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#08090b",
        color: "var(--text)",
        overflow: "hidden",
      }}
    >
      {/* TOP IDE BAR */}
      <header
        style={{
          height: 48,
          background: "#0c0d12",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          userSelect: "none",
          zIndex: 20,
        }}
      >
        {/* LEFT: BACK & PROJECT TITLE */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={() => router.push("/")}
            title="Return to Dashboard"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text)",
              fontSize: 12,
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={13} />
            <span>Dashboard</span>
          </button>

          <div style={{ height: 16, width: 1, background: "var(--border)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {projectData?.source === "github" ? (
              <GithubIcon style={{ width: 16, height: 16, opacity: 0.8 }} />
            ) : (
              <FolderGit2 size={16} style={{ color: "var(--accent)" }} />
            )}
            <strong style={{ fontSize: 13, color: "#f8fafc" }}>
              {projectData?.name || "RepoAI Workspace"}
            </strong>

            {projectData?.repository_url && (
              <a
                href={projectData.repository_url}
                target="_blank"
                rel="noreferrer"
                title="View on GitHub"
                style={{
                  display: "flex",
                  alignItems: "center",
                  color: "var(--muted)",
                  padding: 2,
                }}
              >
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>

        {/* RIGHT: PANEL CONTROLS & AI STATUS */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => setTriggeredPrompt("Provide a comprehensive architectural and code analysis of this project.")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(124, 92, 255, 0.12)",
              border: "1px solid rgba(124, 92, 255, 0.35)",
              borderRadius: 6,
              color: "#c4b5fd",
              fontSize: 12,
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            <Sparkles size={13} style={{ color: "var(--accent)" }} />
            <span>Analyze Architecture</span>
          </button>

          <div style={{ height: 16, width: 1, background: "var(--border)" }} />

          <button
            type="button"
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
            title={leftSidebarOpen ? "Hide File Explorer" : "Show File Explorer"}
            style={{
              background: "transparent",
              border: "none",
              color: leftSidebarOpen ? "#fff" : "var(--muted)",
              padding: 4,
              cursor: "pointer",
            }}
          >
            {leftSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>

          <button
            type="button"
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            title={rightPanelOpen ? "Hide AI Assistant" : "Show AI Assistant"}
            style={{
              background: "transparent",
              border: "none",
              color: rightPanelOpen ? "#fff" : "var(--muted)",
              padding: 4,
              cursor: "pointer",
            }}
          >
            {rightPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
        </div>
      </header>

      {/* WORKSPACE 3-COLUMN LAYOUT */}
      <div
        style={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* LEFT: FILE EXPLORER */}
        {leftSidebarOpen && (
          <aside
            style={{
              width: 260,
              minWidth: 200,
              maxWidth: 360,
              background: "#0c0d12",
              borderRight: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderBottom: "1px solid var(--border)",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--muted)",
                letterSpacing: "0.5px",
                textTransform: "uppercase",
              }}
            >
              <span>Files</span>
              <span style={{ fontSize: 10, color: "var(--muted)" }}>
                {projectData?.stats?.total_files ? `${projectData.stats.total_files} items` : ""}
              </span>
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
              <FileTree
                tree={tree}
                activeFilePath={activeFilePath}
                onSelectFile={openFile}
              />
            </div>
          </aside>
        )}

        {/* CENTER: CODE VIEWER */}
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <CodeViewer
            openTabs={openTabs}
            activeFilePath={activeFilePath}
            projectName={projectData?.name}
            onSelectTab={(path) => setActiveFilePath(path)}
            onCloseTab={closeTab}
            onTriggerPrompt={(prompt) => {
              setRightPanelOpen(true);
              setTriggeredPrompt(prompt);
            }}
          />
        </main>

        {/* RIGHT: AI AGENT PANEL */}
        {rightPanelOpen && (
          <aside
            style={{
              width: 420,
              minWidth: 320,
              maxWidth: 580,
              display: "flex",
              flexDirection: "column",
              background: "#0c0d12",
            }}
          >
            <AiAgentPanel
              projectId={projectId}
              activeFilePath={activeFilePath}
              initialPrompt={triggeredPrompt}
              onClearInitialPrompt={() => setTriggeredPrompt(undefined)}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            background: "var(--background)",
            color: "var(--text)",
          }}
        >
          <Loader2 size={30} className="spin" style={{ color: "var(--accent)" }} />
        </div>
      }
    >
      <EditorContent />
    </Suspense>
  );
}