"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null;

  // Split content by code blocks ```lang ... ```
  const parts: React.ReactNode[] = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;
  let blockIndex = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const textBefore = content.substring(lastIndex, match.index);
    if (textBefore.trim()) {
      parts.push(
        <div key={`text-${lastIndex}`} className="markdown-prose">
          {renderText(textBefore)}
        </div>
      );
    }

    const language = match[1] || "text";
    const code = match[2];
    parts.push(
      <CodeSnippet key={`code-${blockIndex++}`} language={language} code={code} />
    );

    lastIndex = match.index + match[0].length;
  }

  const remaining = content.substring(lastIndex);
  if (remaining.trim()) {
    parts.push(
      <div key={`text-${lastIndex}`} className="markdown-prose">
        {renderText(remaining)}
      </div>
    );
  }

  return <div className="markdown-container" style={{ display: "flex", flexDirection: "column", gap: 12 }}>{parts}</div>;
}

function CodeSnippet({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "#08090b",
        overflow: "hidden",
        margin: "8px 0",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 12px",
          background: "rgba(255,255,255,0.03)",
          borderBottom: "1px solid var(--border)",
          fontSize: 11,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        <span>{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "transparent",
            border: "none",
            color: copied ? "#4ade80" : "var(--muted)",
            fontSize: 11,
            cursor: "pointer",
            padding: "2px 6px",
            borderRadius: 4,
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: "12px 14px",
          overflowX: "auto",
          fontSize: 12.5,
          lineHeight: 1.6,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          color: "#e2e8f0",
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderText(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      nodes.push(<div key={`empty-${i}`} style={{ height: 6 }} />);
      continue;
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      nodes.push(
        <h3
          key={`h3-${i}`}
          style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: "10px 0 4px 0" }}
        >
          {formatInline(trimmed.substring(4))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      nodes.push(
        <h2
          key={`h2-${i}`}
          style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", margin: "14px 0 6px 0", borderBottom: "1px solid var(--border)", paddingBottom: 4 }}
        >
          {formatInline(trimmed.substring(3))}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith("# ")) {
      nodes.push(
        <h1
          key={`h1-${i}`}
          style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: "16px 0 8px 0" }}
        >
          {formatInline(trimmed.substring(2))}
        </h1>
      );
      continue;
    }

    // Bullet lists
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      nodes.push(
        <div
          key={`li-${i}`}
          style={{
            display: "flex",
            gap: 8,
            fontSize: 13,
            lineHeight: 1.6,
            color: "#d1d5db",
            paddingLeft: 4,
          }}
        >
          <span style={{ color: "var(--accent)" }}>•</span>
          <span style={{ flex: 1 }}>{formatInline(trimmed.substring(2))}</span>
        </div>
      );
      continue;
    }

    // Numbered lists
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      nodes.push(
        <div
          key={`num-${i}`}
          style={{
            display: "flex",
            gap: 8,
            fontSize: 13,
            lineHeight: 1.6,
            color: "#d1d5db",
            paddingLeft: 4,
          }}
        >
          <span style={{ color: "var(--accent)", fontWeight: 600, minWidth: 16 }}>{numMatch[1]}.</span>
          <span style={{ flex: 1 }}>{formatInline(numMatch[2])}</span>
        </div>
      );
      continue;
    }

    // Paragraph
    nodes.push(
      <p
        key={`p-${i}`}
        style={{
          fontSize: 13,
          lineHeight: 1.6,
          color: "#cbd5e1",
          margin: "4px 0",
        }}
      >
        {formatInline(line)}
      </p>
    );
  }

  return nodes;
}

function formatInline(str: string): React.ReactNode[] {
  // Parse inline `code` and **bold**
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let idx = 0;

  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push(str.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={`inline-${idx++}`}
          style={{
            background: "rgba(255,255,255,0.08)",
            padding: "2px 5px",
            borderRadius: 4,
            fontSize: "0.9em",
            fontFamily: "monospace",
            color: "#a78bfa",
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={`bold-${idx++}`} style={{ fontWeight: 600, color: "var(--text)" }}>
          {token.slice(2, -2)}
        </strong>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < str.length) {
    parts.push(str.substring(lastIndex));
  }

  return parts;
}
