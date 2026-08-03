"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useLiveRefresh } from "@/lib/data-events";
import { useSupabase } from "@/providers/SupabaseProvider";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  InterviewStatus,
} from "@/lib/interviews-workflow";

interface Interview {
  id: string;
  interviewNumber: string;
  templateId: string;
  templateName: string;
  status: InterviewStatus;
  progress: number;
  currentSection: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export default function InterviewsPage() {
  const { session, loading } = useSupabase();
  const router = useRouter();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [templateFilter, setTemplateFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newInterviewTemplate, setNewInterviewTemplate] = useState("fnol-v1");

  useEffect(() => {
    if (!loading && !session) {
      router.push("/login");
      return;
    }
    loadInterviews();
  }, [session, loading, router, statusFilter, templateFilter, page]);

  useLiveRefresh(() => loadInterviews());

  const loadInterviews = async () => {
    try {
      setLoadingInterviews(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (templateFilter) params.append("templateId", templateFilter);
      params.append("page", page.toString());
      params.append("limit", "20");

      const response = await apiFetch<{ data: Interview[]; pagination: any }>(
        `/interviews?${params}`,
      );
      setInterviews(response.data || []);
      setTotalPages(response.pagination?.totalPages || 1);
    } catch (e: any) {
      setError(`Error loading interviews: ${e.message}`);
    } finally {
      setLoadingInterviews(false);
    }
  };

  const createInterview = async () => {
    try {
      const data = await apiFetch<{ id: string }>("/interviews", {
        method: "POST",
        body: JSON.stringify({
          templateId: newInterviewTemplate,
          templateName:
            newInterviewTemplate === "fnol-v1"
              ? "First Notice of Loss (FNOL)"
              : "Custom Interview",
        }),
      });
      router.push(`/admin/interviews/${data.id}`);
    } catch (e: any) {
      setError(`Error creating interview: ${e.message}`);
    }
  };

  if (loading || loadingInterviews) return <p>Loading...</p>;
  if (!session) return null;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">Interviews</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-info text-foreground rounded hover:bg-info"
        >
          New Interview
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {showCreateForm && (
        <div className="mb-6 p-4 bg-surface rounded shadow">
          <h2 className="text-lg font-semibold mb-4">Create New Interview</h2>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground mb-1">
                Template
              </label>
              <select
                value={newInterviewTemplate}
                onChange={(e) => setNewInterviewTemplate(e.target.value)}
                className="w-full px-3 py-2 bg-muted dark:bg-card border border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
                aria-label="Interview template"
              >
                <option value="fnol-v1">First Notice of Loss (FNOL)</option>
              </select>
            </div>
            <div className="flex gap-2 items-end">
              <button
                onClick={createInterview}
                className="px-4 py-2 bg-info text-foreground rounded hover:bg-info"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-muted text-foreground rounded hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 p-4 bg-surface rounded shadow">
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-muted dark:bg-card border border-input rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
              aria-label="Filter by status"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Template
            </label>
            <select
              value={templateFilter}
              onChange={(e) => setTemplateFilter(e.target.value)}
              className="px-3 py-2 bg-muted dark:bg-card border border-input rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
              aria-label="Filter by template"
            >
              <option value="">All Templates</option>
              <option value="fnol-v1">FNOL</option>
            </select>
          </div>
        </div>
      </div>

      {/* Interviews Table */}
      <div className="bg-surface shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Interview #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Template
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Progress
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Updated
              </th>
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-border">
            {interviews.map((interview) => (
              <tr
                key={interview.id}
                className="hover:bg-muted cursor-pointer"
                onClick={() => router.push(`/admin/interviews/${interview.id}`)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-info hover:text-blue-800 font-medium">
                    {interview.interviewNumber}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {interview.templateName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[interview.status]}`}
                  >
                    {STATUS_LABELS[interview.status]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-24 bg-muted rounded-full h-2 mr-2 overflow-hidden">
                      <div
                        className="bg-info h-2 rounded-full transition-all"
                        style={{
                          width: `${interview.progress}%`,
                        }} /* eslint-disable-line react/no-inline-styles */
                      ></div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {Math.round(interview.progress)}%
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  {new Date(interview.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  {new Date(interview.updatedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-muted rounded hover:bg-accent disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-muted rounded hover:bg-accent disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
