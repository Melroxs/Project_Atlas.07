"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSupabase } from "@/providers/SupabaseProvider";
import { apiFetch } from "@/lib/api";
import { useLiveRefresh } from "@/lib/data-events";
import AskAtlas from "@/components/intelligence/AskAtlas";
import NewProjectDialog from "@/components/projects/NewProjectDialog";

interface ActivityLog {
  id: string;
  entityType: string;
  entityName: string | null;
  action: string;
  description: string | null;
  userName: string | null;
  createdAt: string;
}

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: Array<{
    name: string;
    status: "pass" | "fail" | "warn";
    message: string;
  }>;
}

const getActivityIcon = (action: string, entityType: string) => {
  const actionLower = action.toLowerCase();
  const entityLower = entityType.toLowerCase();
  if (actionLower === "create") return "➕";
  if (actionLower === "update") return "✏️";
  if (actionLower === "delete") return "🗑️";
  if (actionLower === "upload") return "📤";
  if (actionLower === "status_change") return "🔄";
  if (actionLower === "interview") return "💬";
  if (actionLower === "supplement") return "📄";
  if (entityLower === "claim") return "📋";
  if (entityLower === "document") return "📁";
  if (entityLower === "property") return "🏠";
  if (entityLower === "company") return "🏢";
  if (entityLower === "adjuster") return "👔";
  if (entityLower === "task") return "✅";
  return "📝";
};

export default function HomePage() {
  const { session, loading } = useSupabase();
  const router = useRouter();
  const [showNewProject, setShowNewProject] = useState(false);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [feedStatus, setFeedStatus] = useState("");

  useEffect(() => {
    if (!session) {
      router.push("/login");
      return;
    }
    loadDashboard();
  }, [session, router]);

  useLiveRefresh(() => loadDashboard());

  const loadDashboard = async () => {
    try {
      const [activityData, healthData] = await Promise.all([
        apiFetch("/activity?limit=6"),
        apiFetch("/intelligence/health"),
      ]);
      const activityResponse = activityData as {
        data?: ActivityLog[];
        pagination?: unknown;
      };
      setActivities(
        Array.isArray(activityResponse)
          ? activityResponse
          : activityResponse.data || [],
      );
      setHealth(healthData as HealthStatus);
    } catch (e: any) {
      setFeedStatus(`Dashboard feed unavailable: ${e.message}`);
    }
  };

  if (loading || !session) return null;

  const healthColor =
    health?.status === "healthy"
      ? "text-green-700 bg-green-50"
      : health?.status === "degraded"
        ? "text-yellow-700 bg-yellow-50"
        : "text-red-700 bg-red-50";

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowNewProject(true)}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors inline-flex items-center gap-2"
        >
          <span className="text-base leading-none">+</span> New Project
        </button>
      </div>

      <AskAtlas />

      {/* Live dashboard feed */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-surface rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Recent Activity
            </h2>
            <Link
              href="/admin/activity"
              className="text-sm text-primary hover:text-primary/90 font-medium"
            >
              View all →
            </Link>
          </div>
          {feedStatus && (
            <p className="text-sm text-muted-foreground mb-3">{feedStatus}</p>
          )}
          {activities.length === 0 && !feedStatus ? (
            <p className="text-sm text-muted-foreground">
              No activity yet. Create a claim or upload a document to see live
              activity here.
            </p>
          ) : (
            <ul className="space-y-3">
              {activities.map((activity) => (
                <li
                  key={activity.id}
                  className="flex items-start gap-3 p-3 bg-muted rounded-lg"
                >
                  <span className="text-lg leading-none mt-0.5">
                    {getActivityIcon(activity.action, activity.entityType)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-medium capitalize">
                        {activity.action.replace(/_/g, " ")}
                      </span>{" "}
                      {activity.entityName ||
                        activity.entityType.toLowerCase()}
                      {activity.description
                        ? ` — ${activity.description}`
                        : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {activity.userName || "System"} ·{" "}
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* System Health */}
        <div className="bg-surface rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              System Health
            </h2>
            <Link
              href="/admin/system-health"
              className="text-sm text-primary hover:text-primary/90 font-medium"
            >
              Details →
            </Link>
          </div>
          {health ? (
            <>
              <div
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${healthColor}`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    health.status === "healthy"
                      ? "bg-green-600"
                      : health.status === "degraded"
                        ? "bg-yellow-500"
                        : "bg-red-600"
                  }`}
                />
                {health.status.toUpperCase()}
              </div>
              <ul className="mt-4 space-y-2">
                {health.checks.map((check) => (
                  <li
                    key={check.name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground capitalize">
                      {check.name.replace(/_/g, " ")}
                    </span>
                    <span
                      className={
                        check.status === "pass"
                          ? "text-green-600"
                          : check.status === "warn"
                            ? "text-yellow-600"
                            : "text-red-600"
                      }
                    >
                      {check.status === "pass"
                        ? "✓"
                        : check.status === "warn"
                          ? "⚠"
                          : "✗"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                Last checked: {new Date(health.timestamp).toLocaleString()}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Health data unavailable.
            </p>
          )}
        </div>
      </div>

      <NewProjectDialog
        open={showNewProject}
        onClose={() => setShowNewProject(false)}
      />
    </>
  );
}
