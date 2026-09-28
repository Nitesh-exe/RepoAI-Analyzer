"use client";

import { useState } from "react";
import {
  X,
  Copy,
  Check,
  Code2,
  Sparkles,
  Shield,
  Layers,
  FileCode,
  FolderGit2,
} from "lucide-react";

export interface OpenFileTab {
  path: string;
  name: string;
  extension: string;
  content: string;
  lines_count: number;
  size_bytes: number;
}

interface CodeViewerProps {
  openTabs: OpenFileTab[];
  activeFilePath?: string;
  projectName?: string;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onTriggerPrompt: (prompt: string) => void;
}

export default function CodeViewer({
  openTabs,
  activeFilePath,
  projectName = "Project",
  onSelectTab,
  onCloseTab,
  onTriggerPrompt,
}: CodeViewerProps) {
  const [copied, setCopied] = useState(false);

  const activeTab = openTabs.find((t) => t.path === activeFilePath);

  const handleCopyCode = () => {
    if (!activeTab) return;
    navigator.clipboard.writeText(activeTab.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = activeTab ? activeTab.content.split("\n") : [];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#08090b",
        overflow: "hidden",
      }}
    >
      {/* TABS HEADER */}
      {openTabs.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "#0c0d11",
            borderBottom: "1px solid var(--border)",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {openTabs.map((tab) => {
            const isActive = tab.path === activeFilePath;
            return (
              <div
                key={tab.path}
                onClick={() => onSelectTab(tab.path)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  fontSize: 12.5,
                  cursor: "pointer",
                  background: isActive ? "#08090b" : "transparent",
                  color: isActive ? "#ffffff" : "var(--muted)",
                  borderRight: "1px solid rgba(255,255,255,0.06)",
                  borderTop: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                }}
              >
                <FileCode size={13} style={{ color: isActive ? "var(--accent)" : "var(--muted)" }} />
                <span>{tab.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.path);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "inherit",
                    padding: 2,
                    borderRadius: 3,
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    opacity: 0.7,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-HEADER BREADCRUMB & ACTIONS */}
      {activeTab ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px 16px",
            background: "#0a0c10",
            borderBottom: "1px solid var(--border)",
            fontSize: 11.5,
            color: "var(--muted)",
          }}
        >
          {/* BREADCRUMB */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>{projectName}</span>
            <span>/</span>
            <span style={{ color: "#e2e8f0" }}>{activeTab.path}</span>
          </div>

          {/* META & COPY */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span>{activeTab.lines_count} lines</span>
            <span>{formatBytes(activeTab.size_bytes)}</span>
            <button
              type="button"
              onClick={handleCopyCode}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "2px 8px",
                color: copied ? "#4ade80" : "var(--muted)",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* CODE VIEW OR WELCOME OVERVIEW */}
      {activeTab ? (
        <div
          style={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 12.5,
            lineHeight: 1.6,
            background: "#08090b",
          }}
        >
          {/* LINE NUMBERS */}
          <div
            style={{
              padding: "12px 14px 12px 8px",
              textAlign: "right",
              color: "#475569",
              userSelect: "none",
              background: "#0a0b0e",
              borderRight: "1px solid rgba(255,255,255,0.04)",
              minWidth: 46,
            }}
          >
            {lines.map((_, idx) => (
              <div key={idx} style={{ height: "20px" }}>
                {idx + 1}
              </div>
            ))}
          </div>

          {/* CODE CONTENT */}
          <pre
            style={{
              margin: 0,
              padding: "12px 16px",
              color: "#e2e8f0",
              overflowX: "auto",
              flex: 1,
              background: "transparent",
            }}
          >
            <code>
              {lines.map((line, idx) => (
                <div key={idx} style={{ height: "20px", whiteSpace: "pre" }}>
                  {line || " "}
                </div>
              ))}
            </code>
          </pre>
        </div>
      ) : (
        /* WELCOME / EMPTY STATE */
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 24px",
            textAlign: "center",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "rgba(124, 92, 255, 0.12)",
              border: "1px solid rgba(124, 92, 255, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              color: "var(--accent)",
            }}
          >
            <Code2 size={26} />
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 6px 0", color: "#f8fafc" }}>
            {projectName}
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "var(--muted)",
              maxWidth: 480,
              margin: "0 0 28px 0",
              lineHeight: 1.5,
            }}
          >
            Select a file from the explorer on the left to read code, or use our AI Agent on the right to analyze the architecture and components.
          </p>

          {/* QUICK PROMPT CARDS */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
              width: "100%",
              maxWidth: 580,
            }}
          >
            <QuickActionCard
              icon={<Sparkles size={16} color="#7c5cff" />}
              title="Project Architecture"
              desc="Understand main modules, services, and system flow"
              onClick={() => onTriggerPrompt("Provide a comprehensive architectural overview of this project, explaining the roles of key directories, entry points, and data flow.")}
            />
            <QuickActionCard
              icon={<Shield size={16} color="#38bdf8" />}
              title="Security & Auth Review"
              desc="Analyze authentication tokens, guards, and potential bugs"
              onClick={() => onTriggerPrompt("Analyze how authentication, permissions, and security are implemented in this repository, pointing out potential vulnerabilities or bugs.")}
            />
            <QuickActionCard
              icon={<Layers size={16} color="#eab308" />}
              title="API & Routes Breakdown"
              desc="Discover all endpoints, handlers, and external services"
              onClick={() => onTriggerPrompt("Map out all backend endpoints or frontend routes in this codebase, explaining what each handler does.")}
            />
            <QuickActionCard
              icon={<FolderGit2 size={16} color="#4ade80" />}
              title="Code Quality & Tests"
              desc="Inspect testing setup, patterns, and code structure"
              onClick={() => onTriggerPrompt("Review software engineering practices, testing coverage, and error handling patterns across this project.")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function QuickActionCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "14px 16px",
        textAlign: "left",
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(124, 92, 255, 0.08)";
        e.currentTarget.style.borderColor = "rgba(124, 92, 255, 0.35)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.02)";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        {icon}
        <strong style={{ fontSize: 13, color: "#f1f5f9" }}>{title}</strong>
      </div>
      <p style={{ margin: 0, fontSize: 11.5, color: "var(--muted)", lineHeight: 1.4 }}>{desc}</p>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
