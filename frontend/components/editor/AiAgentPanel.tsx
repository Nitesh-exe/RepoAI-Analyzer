"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  Sparkles,
  Bot,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Key,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  FileCode,
  Layers,
} from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import { supabase } from "@/lib/supabase";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface StepLog {
  iteration: number;
  command: string;
  success: boolean;
  output_preview: string;
}

interface AnalysisResult {
  query: string;
  final_report: string;
  key_findings: string[];
  steps_log: StepLog[];
  review_cycles: number;
  confidence_score: number;
  status: "accepted" | "forced";
  specialist_feedback?: string;
}

interface AiAgentPanelProps {
  projectId: string;
  activeFilePath?: string;
  initialPrompt?: string;
  onClearInitialPrompt?: () => void;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function AiAgentPanel({
  projectId,
  activeFilePath,
  initialPrompt,
  onClearInitialPrompt,
}: AiAgentPanelProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "deep">("chat");

  // Chat State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm your **RepoAI Codebase Assistant**, powered by the Google Gemini API. Ask me anything about this repository, request code explanations, or run a **Deep Multi-Agent Analysis** to uncover architecture and data flows.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Deep Analysis State
  const [analysisQuery, setAnalysisQuery] = useState(
    "Provide a comprehensive architectural and code analysis of this project."
  );
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // Gemini API Key State
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem("repoai_gemini_api_key");
    if (savedKey) setGeminiApiKey(savedKey);
  }, []);

  // Handle triggered prompt from CodeViewer welcome screen
  useEffect(() => {
    if (initialPrompt) {
      if (initialPrompt.includes("comprehensive") || initialPrompt.includes("architectural")) {
        setActiveTab("deep");
        setAnalysisQuery(initialPrompt);
      } else {
        setActiveTab("chat");
        sendMessage(initialPrompt);
      }
      onClearInitialPrompt?.();
    }
  }, [initialPrompt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  const saveApiKey = (key: string) => {
    setGeminiApiKey(key);
    localStorage.setItem("repoai_gemini_api_key", key);
    setApiKeyModalOpen(false);
  };

  const getAuthHeaders = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
    const key = geminiApiKey || localStorage.getItem("repoai_gemini_api_key");
    if (key) {
      headers["X-Gemini-Api-Key"] = key;
    }
    return headers;
  };

  const sendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || chatLoading) return;

    const userMsg: Message = {
      id: Math.random().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage("");
    setChatLoading(true);

    try {
      const headers = await getAuthHeaders();
      const historyPayload = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(`${BACKEND_URL}/api/projects/${projectId}/chat/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: text.trim(),
          history: historyPayload,
          active_file: activeFilePath || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Chat request failed");
      }

      const assistantMsg: Message = {
        id: Math.random().toString(),
        role: "assistant",
        content: data.reply || "I couldn't generate a response for this query.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: Math.random().toString(),
        role: "assistant",
        content: `⚠️ **Error**: ${err.message || "Failed to reach AI service."} ${
          !geminiApiKey ? "\n\n💡 *Tip: Click the Key icon at the top to configure your Gemini API key.*" : ""
        }`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  const runDeepAnalysis = async () => {
    if (analysisLoading) return;
    setAnalysisLoading(true);
    setAnalysisResult(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND_URL}/api/projects/${projectId}/analyze/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: analysisQuery.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      setAnalysisResult(data.analysis);
    } catch (err: any) {
      alert(`Analysis error: ${err.message || "Could not complete analysis."}`);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const copyAnalysisReport = () => {
    if (!analysisResult?.final_report) return;
    navigator.clipboard.writeText(analysisResult.final_report);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#0c0d12",
        borderLeft: "1px solid var(--border)",
        overflow: "hidden",
      }}
    >
      {/* HEADER WITH TABS & KEY CONFIG */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: "#0e1017",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", padding: 2, borderRadius: 6 }}>
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
              background: activeTab === "chat" ? "var(--accent)" : "transparent",
              color: activeTab === "chat" ? "#fff" : "var(--muted)",
              border: "none",
              cursor: "pointer",
            }}
          >
            <Bot size={13} />
            Chat
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("deep")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
              background: activeTab === "deep" ? "var(--accent)" : "transparent",
              color: activeTab === "deep" ? "#fff" : "var(--muted)",
              border: "none",
              cursor: "pointer",
            }}
          >
            <Sparkles size={13} />
            Deep Analysis
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* GEMINI KEY BUTTON */}
          <button
            type="button"
            onClick={() => setApiKeyModalOpen(true)}
            title="Configure Gemini API Key"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 8px",
              borderRadius: 5,
              fontSize: 11,
              background: geminiApiKey ? "rgba(74, 222, 128, 0.1)" : "rgba(255,255,255,0.05)",
              color: geminiApiKey ? "#4ade80" : "var(--muted)",
              border: geminiApiKey ? "1px solid rgba(74, 222, 128, 0.3)" : "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            <Key size={12} />
            <span>{geminiApiKey ? "Key Active" : "Set API Key"}</span>
          </button>

          {activeTab === "chat" && (
            <button
              type="button"
              onClick={() =>
                setMessages([
                  {
                    id: "welcome",
                    role: "assistant",
                    content: "Conversation history reset. How can I assist you with this codebase?",
                    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  },
                ])
              }
              title="Reset Chat"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--muted)",
                padding: 4,
                cursor: "pointer",
              }}
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ACTIVE CONTEXT PILL */}
      {activeFilePath && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            background: "rgba(124, 92, 255, 0.08)",
            borderBottom: "1px solid rgba(124, 92, 255, 0.2)",
            fontSize: 11,
            color: "#c4b5fd",
          }}
        >
          <FileCode size={12} />
          <span>Active context:</span>
          <strong style={{ color: "#fff" }}>{activeFilePath.split("/").pop()}</strong>
        </div>
      )}

      {/* TAB 1: INTERACTIVE CHAT */}
      {activeTab === "chat" ? (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          {/* MESSAGES LIST */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignSelf: isUser ? "flex-end" : "flex-start",
                    maxWidth: isUser ? "85%" : "100%",
                  }}
                >
                  <div
                    style={{
                      background: isUser ? "var(--accent)" : "rgba(255,255,255,0.03)",
                      border: isUser ? "none" : "1px solid var(--border)",
                      color: isUser ? "#ffffff" : "#f1f5f9",
                      padding: "10px 14px",
                      borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                      fontSize: 13,
                      lineHeight: 1.55,
                    }}
                  >
                    {isUser ? (
                      msg.content
                    ) : (
                      <MarkdownRenderer content={msg.content} />
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--muted)",
                      marginTop: 3,
                      alignSelf: isUser ? "flex-end" : "flex-start",
                      padding: "0 4px",
                    }}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              );
            })}

            {chatLoading && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border)",
                  padding: "10px 14px",
                  borderRadius: "12px 12px 12px 2px",
                  fontSize: 12.5,
                  color: "var(--muted)",
                  width: "fit-content",
                }}
              >
                <Loader2 size={14} className="spin" style={{ color: "var(--accent)" }} />
                <span>RepoAI is analyzing the codebase...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* QUICK CHIP SUGGESTIONS */}
          <div
            style={{
              display: "flex",
              gap: 6,
              overflowX: "auto",
              padding: "6px 12px",
              borderTop: "1px solid var(--border)",
              scrollbarWidth: "none",
            }}
          >
            {[
              activeFilePath ? "Explain this file" : "Explain repository",
              "Where is authentication handled?",
              "Find potential bugs",
              "How to add a feature?",
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => sendMessage(chip)}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: "3px 10px",
                  fontSize: 11,
                  color: "var(--muted)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* INPUT BAR */}
          <div
            style={{
              padding: "10px 12px",
              background: "#0a0c10",
              borderTop: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 10px",
              }}
            >
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask anything about this project... (Enter to send)"
                rows={1}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--text)",
                  fontSize: 12.5,
                  resize: "none",
                  maxHeight: 120,
                  fontFamily: "inherit",
                }}
              />
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={!inputMessage.trim() || chatLoading}
                style={{
                  background: inputMessage.trim() ? "var(--accent)" : "rgba(255,255,255,0.06)",
                  border: "none",
                  color: "#ffffff",
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: inputMessage.trim() ? "pointer" : "not-allowed",
                  transition: "background 0.2s ease",
                  flexShrink: 0,
                }}
              >
                {chatLoading ? <Loader2 size={13} className="spin" /> : <Send size={13} />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* TAB 2: DEEP MULTI-AGENT ANALYSIS */
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* PROMPT INPUT & TRIGGER */}
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Layers size={15} style={{ color: "var(--accent)" }} />
              <strong style={{ fontSize: 13, color: "#f8fafc" }}>Multi-Agent Deep Analyzer</strong>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
              Runs the iterative multi-agent engine: Code Analyzer performs shell-based exploration rounds, and Task Specialist reviews technical completeness.
            </p>

            <textarea
              value={analysisQuery}
              onChange={(e) => setAnalysisQuery(e.target.value)}
              placeholder="What task or component should the agent analyze?"
              rows={2}
              style={{
                background: "rgba(0,0,0,0.3)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "8px 10px",
                color: "var(--text)",
                fontSize: 12,
                outline: "none",
                resize: "vertical",
              }}
            />

            <button
              type="button"
              onClick={runDeepAnalysis}
              disabled={analysisLoading || !analysisQuery.trim()}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "9px 16px",
                borderRadius: 6,
                background: "var(--accent)",
                color: "#ffffff",
                border: "none",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: analysisLoading ? "not-allowed" : "pointer",
                opacity: analysisLoading ? 0.7 : 1,
              }}
            >
              {analysisLoading ? (
                <>
                  <Loader2 size={14} className="spin" />
                  Running Discovery & Review Cycles...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Start Multi-Agent Analysis
                </>
              )}
            </button>
          </div>

          {/* LOADING ANIMATION */}
          {analysisLoading && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "20px",
                borderRadius: 8,
                background: "rgba(124, 92, 255, 0.05)",
                border: "1px solid rgba(124, 92, 255, 0.2)",
                textAlign: "center",
                alignItems: "center",
              }}
            >
              <Loader2 size={24} className="spin" style={{ color: "var(--accent)" }} />
              <strong style={{ fontSize: 13, color: "#e2e8f0" }}>Analyzing Codebase Structure</strong>
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--muted)", maxWidth: 320 }}>
                Agents are exploring files via secure read-only shell commands and evaluating technical completeness with Task Specialist.
              </p>
            </div>
          )}

          {/* RESULTS DISPLAY */}
          {analysisResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* METRICS & STATUS BADGES */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "10px 12px",
                  }}
                >
                  <span style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>Confidence Score</span>
                  <strong style={{ fontSize: 16, color: "#4ade80" }}>
                    {(analysisResult.confidence_score * 100).toFixed(0)}%
                  </strong>
                </div>

                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "10px 12px",
                  }}
                >
                  <span style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>Review Cycles</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                    <CheckCircle2 size={14} color="#4ade80" />
                    <strong style={{ fontSize: 13, color: "#e2e8f0" }}>
                      Cycle {analysisResult.review_cycles} ({analysisResult.status})
                    </strong>
                  </div>
                </div>
              </div>

              {/* KEY FINDINGS */}
              {analysisResult.key_findings?.length > 0 && (
                <div
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "12px 14px",
                  }}
                >
                  <strong style={{ fontSize: 12.5, color: "#e2e8f0", display: "block", marginBottom: 8 }}>
                    Discovered Key Findings
                  </strong>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {analysisResult.key_findings.map((f, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "#cbd5e1", lineHeight: 1.4 }}>
                        <span style={{ color: "var(--accent)" }}>•</span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SHELL COMMANDS EXECUTED (ACCORDION) */}
              {analysisResult.steps_log?.length > 0 && (
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  <div
                    onClick={() => setStepsExpanded(!stepsExpanded)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "rgba(255,255,255,0.03)",
                      cursor: "pointer",
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Terminal size={13} />
                      <span>Executed Inspection Commands ({analysisResult.steps_log.length})</span>
                    </div>
                    {stepsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>

                  {stepsExpanded && (
                    <div
                      style={{
                        padding: "8px 12px",
                        background: "#08090b",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        maxHeight: 200,
                        overflowY: "auto",
                        fontFamily: "monospace",
                        fontSize: 11,
                      }}
                    >
                      {analysisResult.steps_log.map((step, idx) => (
                        <div key={idx} style={{ color: "#94a3b8" }}>
                          <span style={{ color: "#38bdf8" }}>$ {step.command}</span>
                          <span style={{ color: step.success ? "#4ade80" : "#ef4444", marginLeft: 6 }}>
                            {step.success ? "✓" : "✗"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* FINAL REPORT */}
              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: 14, color: "#f8fafc" }}>Synthesized Analysis Report</strong>
                  <button
                    type="button"
                    onClick={copyAnalysisReport}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      padding: "3px 8px",
                      fontSize: 11,
                      color: copiedReport ? "#4ade80" : "var(--muted)",
                      cursor: "pointer",
                    }}
                  >
                    {copiedReport ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedReport ? "Copied" : "Copy Report"}</span>
                  </button>
                </div>

                <MarkdownRenderer content={analysisResult.final_report} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* GEMINI API KEY MODAL */}
      {apiKeyModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setApiKeyModalOpen(false)}
          style={{ zIndex: 100 }}
        >
          <div
            className="upload-modal"
            style={{ maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="upload-modal-header">
              <div>
                <span className="section-label">AI CONFIGURATION</span>
                <h2>Google Gemini API Key</h2>
                <p>Enter your Gemini API key to power codebase chat and multi-agent analysis.</p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "14px 0" }}>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "10px 12px",
                  color: "var(--text)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                Key is stored securely in your browser's local storage and forwarded to the backend analyzer.
              </span>
            </div>

            <div className="upload-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => setApiKeyModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="upload-button"
                onClick={() => saveApiKey(geminiApiKey.trim())}
              >
                Save API Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
