"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import {
  ENTRY_POINTS,
  SECTION_STATE_LABELS,
  SECTION_STATE_COLORS,
  WorkspaceState,
  AITask,
  AI_TASK_LABELS,
} from "@/lib/workflow-engine";

interface ClaimWorkspaceProps {
  claimId: string;
}

export default function ClaimWorkspace({ claimId }: ClaimWorkspaceProps) {
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [taskResults, setTaskResults] = useState<Record<string, string>>({});

  useEffect(() => {
    loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId]);

  const loadWorkspace = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<WorkspaceState>(
        `/multi-entry/workspace/${claimId}`,
      );
      setWorkspace(data);
    } catch (e: any) {
      setError(e.message || "Failed to load workspace");
    } finally {
      setLoading(false);
    }
  };

  const checkTask = async (task: AITask) => {
    try {
      setTaskResults((prev) => ({ ...prev, [task]: "Checking..." }));
      const data = await apiFetch<{
        ready: boolean;
        message: string;
        missingRequired: { label: string }[];
      }>(`/multi-entry/ai-tasks/${task}/check`, {
        method: "POST",
        body: JSON.stringify({ claimId }),
      });
      setTaskResults((prev) => ({
        ...prev,
        [task]: data.ready
          ? `✅ ${data.message}`
          : `⛔ ${data.message}`,
      }));
    } catch (e: any) {
      setTaskResults((prev) => ({
        ...prev,
        [task]: `⚠️ ${e.message || "Check failed"}`,
      }));
    }
  };

  if (loading) {
    return (
      <div className="bg-surface rounded-xl border p-6">
        <p className="text-sm text-muted-foreground">Loading workspace...</p>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="bg-surface rounded-xl border p-6">
        <p className="text-sm text-destructive">{error || "Workspace unavailable"}</p>
      </div>
    );
  }

  const entryMeta = ENTRY_POINTS[workspace.entryPoint];

  return (
    <div className="space-y-6">
      {/* Entry Point Banner */}
      <div className="bg-surface rounded-xl border p-4 flex items-center gap-3">
        <span className="text-2xl">{entryMeta.icon}</span>
        <div>
          <p className="font-semibold text-foreground">{entryMeta.label}</p>
          <p className="text-xs text-muted-foreground">{entryMeta.description}</p>
        </div>
        <span className="ml-auto text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
          {workspace.readyTaskCount} AI task{workspace.readyTaskCount === 1 ? "" : "s"} ready
        </span>
      </div>

      {/* Workspace Sections */}
      <div className="bg-surface rounded-xl border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Claim Workspace
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {workspace.sections.map((section) => (
            <div
              key={section.id}
              className={`p-3 rounded-lg border transition-colors ${
                section.state === "optional"
                  ? "border-dashed bg-warning/5"
                  : "bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-foreground">{section.label}</p>
                <span
                  className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${SECTION_STATE_COLORS[section.state]}`}
                >
                  {SECTION_STATE_LABELS[section.state]}
                </span>
              </div>
              {section.state === "optional" && section.message && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {section.message}
                </p>
              )}
              {section.state === "optional" && section.action && (
                <p className="mt-1 text-xs text-primary">{section.action}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* AI Task Readiness */}
      <div className="bg-surface rounded-xl border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">
          AI Task Readiness
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Each task checks only the evidence it actually needs — missing optional
          modules (like a Claim Package) never block a task.
        </p>
        <div className="space-y-2">
          {workspace.aiTasks.map((task) => (
            <div
              key={task.task}
              className="flex items-center justify-between p-3 rounded-lg border bg-muted/40"
            >
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  {AI_TASK_LABELS[task.task as AITask]}
                </p>
                <p className="text-xs text-muted-foreground">
                  {task.ready ? (
                    <span className="text-success">Ready to run</span>
                  ) : (
                    <>
                      Needs:{" "}
                      {task.missingRequired.length > 0
                        ? task.missingRequired.map((m) => m.label).join(", ")
                        : "required evidence"}
                      {task.missingOptional.length > 0 && (
                        <span className="text-muted-foreground/70">
                          {" "}
                          (optional:{" "}
                          {task.missingOptional.map((m) => m.label).join(", ")}
                          )
                        </span>
                      )}
                    </>
                  )}
                </p>
                {taskResults[task.task] && (
                  <p className="text-xs mt-1 text-muted-foreground">
                    {taskResults[task.task]}
                  </p>
                )}
              </div>
              <button
                onClick={() => checkTask(task.task as AITask)}
                className="ml-3 px-3 py-1.5 text-xs bg-muted hover:bg-accent text-foreground rounded-lg transition-colors"
              >
                Check
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
