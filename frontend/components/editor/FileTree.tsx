"use client";

import { useState } from "react";
import {
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileText,
  FileJson,
  ChevronRight,
  ChevronDown,
  Search,
  X,
} from "lucide-react";

export interface FileItem {
  name: string;
  path: string;
  type: "file" | "directory";
  extension?: string;
  size?: number;
  children?: FileItem[];
}

interface FileTreeProps {
  tree: FileItem[];
  activeFilePath?: string;
  onSelectFile: (path: string) => void;
}

export default function FileTree({
  tree,
  activeFilePath,
  onSelectFile,
}: FileTreeProps) {
  const [filterQuery, setFilterQuery] = useState("");
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());

  const toggleFolder = (path: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Filter items if search query is present
  const filterTree = (items: FileItem[], query: string): FileItem[] => {
    if (!query.trim()) return items;
    const lower = query.toLowerCase();

    return items
      .map((item) => {
        if (item.type === "file") {
          return item.name.toLowerCase().includes(lower) ? item : null;
        }
        const filteredChildren = filterTree(item.children || [], query);
        if (filteredChildren.length > 0 || item.name.toLowerCase().includes(lower)) {
          return { ...item, children: filteredChildren };
        }
        return null;
      })
      .filter(Boolean) as FileItem[];
  };

  const visibleTree = filterQuery ? filterTree(tree, filterQuery) : tree;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* SEARCH / FILTER INPUT */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "4px 8px",
          }}
        >
          <Search size={13} style={{ color: "var(--muted)", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search files..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text)",
              fontSize: 12,
            }}
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery("")}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--muted)",
                padding: 0,
                cursor: "pointer",
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* TREE LIST */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "6px 0",
        }}
      >
        {visibleTree.length === 0 ? (
          <div
            style={{
              padding: "24px 16px",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 12,
            }}
          >
            {filterQuery ? "No matching files" : "Empty repository"}
          </div>
        ) : (
          visibleTree.map((item) => (
            <TreeItemNode
              key={item.path}
              item={item}
              level={0}
              activeFilePath={activeFilePath}
              collapsedPaths={collapsedPaths}
              onToggleFolder={toggleFolder}
              onSelectFile={onSelectFile}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TreeItemNode({
  item,
  level,
  activeFilePath,
  collapsedPaths,
  onToggleFolder,
  onSelectFile,
}: {
  item: FileItem;
  level: number;
  activeFilePath?: string;
  collapsedPaths: Set<string>;
  onToggleFolder: (path: string) => void;
  onSelectFile: (path: string) => void;
}) {
  const isDirectory = item.type === "directory";
  const isCollapsed = collapsedPaths.has(item.path);
  const isActive = activeFilePath === item.path;

  const handleClick = () => {
    if (isDirectory) {
      onToggleFolder(item.path);
    } else {
      onSelectFile(item.path);
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: `4px 12px 4px ${12 + level * 14}px`,
          cursor: "pointer",
          fontSize: 12.5,
          color: isActive ? "#ffffff" : isDirectory ? "#e2e8f0" : "#94a3b8",
          background: isActive
            ? "rgba(124, 92, 255, 0.18)"
            : "transparent",
          borderLeft: isActive
            ? "2px solid var(--accent)"
            : "2px solid transparent",
          userSelect: "none",
          transition: "background 0.15s ease",
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = "transparent";
        }}
      >
        {/* FOLDER EXPAND/COLLAPSE ICON */}
        {isDirectory ? (
          <span style={{ display: "flex", alignItems: "center", opacity: 0.6 }}>
            {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </span>
        ) : (
          <span style={{ width: 13 }} />
        )}

        {/* TYPE ICON */}
        <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          {getFileIcon(item.name, isDirectory, !isCollapsed)}
        </span>

        {/* NAME */}
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontWeight: isActive ? 600 : isDirectory ? 500 : 400,
          }}
        >
          {item.name}
        </span>
      </div>

      {/* CHILDREN */}
      {isDirectory && !isCollapsed && item.children && (
        <div>
          {item.children.map((child) => (
            <TreeItemNode
              key={child.path}
              item={child}
              level={level + 1}
              activeFilePath={activeFilePath}
              collapsedPaths={collapsedPaths}
              onToggleFolder={onToggleFolder}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getFileIcon(filename: string, isDirectory: boolean, isOpen: boolean) {
  if (isDirectory) {
    return isOpen ? (
      <FolderOpen size={14} color="#818cf8" />
    ) : (
      <Folder size={14} color="#818cf8" />
    );
  }

  const ext = filename.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "ts":
    case "tsx":
      return <FileCode size={14} color="#38bdf8" />;
    case "js":
    case "jsx":
      return <FileCode size={14} color="#facc15" />;
    case "py":
      return <FileCode size={14} color="#3b82f6" />;
    case "json":
      return <FileJson size={14} color="#eab308" />;
    case "css":
    case "scss":
      return <FileCode size={14} color="#ec4899" />;
    case "html":
      return <FileCode size={14} color="#f97316" />;
    case "md":
      return <FileText size={14} color="#a855f7" />;
    case "sql":
      return <FileCode size={14} color="#10b981" />;
    case "env":
      return <FileText size={14} color="#fb7185" />;
    default:
      return <File size={14} color="#94a3b8" />;
  }
}
