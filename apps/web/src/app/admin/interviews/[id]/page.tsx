"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useSupabase } from "@/providers/SupabaseProvider";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  InterviewStatus,
  QuestionType,
  Section,
  Question,
} from "@/lib/interviews-workflow";

interface Interview {
  id: string;
  interviewNumber: string;
  templateId: string;
  templateName: string;
  status: InterviewStatus;
  progress: number;
  currentSection: string | null;
  responses: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface InterviewTemplate {
  templateId: string;
  name: string;
  description?: string;
  version: string;
  sections: Section[];
  settings: {
    autosave: boolean;
    autosaveInterval: number;
    allowResume: boolean;
    allowEditAfterComplete: boolean;
    showProgress: boolean;
    showSectionNavigation: boolean;
  };
}

export default function InterviewDetailPage() {
  const { session, loading } = useSupabase();
  const router = useRouter();
  const params = useParams();
  const interviewId = params.id as string;

  const [interview, setInterview] = useState<Interview | null>(null);
  const [template, setTemplate] = useState<InterviewTemplate | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [loadingInterview, setLoadingInterview] = useState(true);
  const [error, setError] = useState("");
  const [autosaveTimeout, setAutosaveTimeout] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<InterviewStatus>("draft");

  useEffect(() => {
    if (!session) {
      router.push("/login");
      return;
    }
    loadInterview();
    loadTemplate();
  }, [session, router, interviewId]);

  const loadInterview = async () => {
    try {
      setLoadingInterview(true);
      const data = await apiFetch<Interview>(`/interviews/${interviewId}`);
      setInterview(data);
      setResponses(data.responses || {});

      // Find current section
      if (data.currentSection && template) {
        const sectionIndex = template.sections.findIndex(
          (s) => s.id === data.currentSection,
        );
        if (sectionIndex >= 0) {
          setCurrentSectionIndex(sectionIndex);
        }
      }
    } catch (e: any) {
      setError(`Error loading interview: ${e.message}`);
    } finally {
      setLoadingInterview(false);
    }
  };

  const loadTemplate = async () => {
    try {
      const data = await apiFetch<InterviewTemplate>(
        `/interviews/${interviewId}/template`,
      );
      if (data) {
        setTemplate(data);
      }
    } catch (e: any) {
      console.error("Error loading template:", e);
    }
  };

  const autosaveResponse = async (
    questionId: string,
    value: any,
    sectionId: string,
  ) => {
    if (autosaveTimeout) {
      clearTimeout(autosaveTimeout);
    }

    const timeout = setTimeout(async () => {
      try {
        await apiFetch(`/interviews/${interviewId}/responses`, {
          method: "PUT",
          body: JSON.stringify({ questionId, value, sectionId }),
        });
      } catch (e: any) {
        console.error("Autosave failed:", e);
      }
    }, 1000);

    setAutosaveTimeout(timeout);
  };

  const handleResponseChange = (
    questionId: string,
    value: any,
    sectionId: string,
  ) => {
    const newResponses = { ...responses, [questionId]: value };
    setResponses(newResponses);
    autosaveResponse(questionId, value, sectionId);
  };

  const handleStatusChange = async () => {
    try {
      await apiFetch(`/interviews/${interviewId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      setShowStatusDialog(false);
      loadInterview();
    } catch (e: any) {
      setError(`Error updating status: ${e.message}`);
    }
  };

  const generateClaim = async () => {
    try {
      const data = await apiFetch<{ claimData: any; message: string }>(
        `/interviews/${interviewId}/generate-claim`,
        {
          method: "POST",
        },
      );
      alert("Claim data extracted. Claim generation not yet implemented.");
    } catch (e: any) {
      setError(`Error generating claim: ${e.message}`);
    }
  };

  const renderQuestionInput = (
    question: Question,
    value: any,
    sectionId: string,
  ) => {
    const handleChange = (newValue: any) => {
      handleResponseChange(question.id, newValue, sectionId);
    };

    switch (question.type) {
      case "short_text":
        return (
          <input
            type="text"
            value={value || ""}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full px-3 py-2 bg-muted dark:bg-card border border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
            placeholder={question.label}
            aria-label={question.label}
          />
        );

      case "long_text":
        return (
          <textarea
            value={value || ""}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full px-3 py-2 bg-muted dark:bg-card border border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
            rows={4}
            placeholder={question.label}
            aria-label={question.label}
          />
        );

      case "number":
        return (
          <input
            type="number"
            value={value || ""}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full px-3 py-2 bg-muted dark:bg-card border border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
            placeholder={question.label}
            aria-label={question.label}
          />
        );

      case "currency":
        return (
          <div className="relative">
            <span className="absolute left-3 top-2 text-muted-foreground">
              $
            </span>
            <input
              type="number"
              value={value || ""}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-muted dark:bg-card border border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
              placeholder="0.00"
              aria-label={question.label}
            />
          </div>
        );

      case "date":
        return (
          <input
            type="date"
            value={value || ""}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full px-3 py-2 bg-muted dark:bg-card border border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
            aria-label={question.label}
          />
        );

      case "time":
        return (
          <input
            type="time"
            value={value || ""}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full px-3 py-2 bg-muted dark:bg-card border border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
            aria-label={question.label}
          />
        );

      case "yes_no":
        return (
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name={question.id}
                value="true"
                checked={value === true}
                onChange={() => handleChange(true)}
                className="mr-2"
                aria-label="Yes"
              />
              Yes
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name={question.id}
                value="false"
                checked={value === false}
                onChange={() => handleChange(false)}
                className="mr-2"
                aria-label="No"
              />
              No
            </label>
          </div>
        );

      case "multiple_choice":
        return (
          <select
            value={value || ""}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full px-3 py-2 bg-muted dark:bg-card border border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
            aria-label={question.label}
          >
            <option value="">Select an option</option>
            {question.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case "multi_select":
        return (
          <div className="space-y-2">
            {question.options?.map((option) => (
              <label key={option} className="flex items-center">
                <input
                  type="checkbox"
                  checked={Array.isArray(value) && value.includes(option)}
                  onChange={(e) => {
                    const current = Array.isArray(value) ? value : [];
                    if (e.target.checked) {
                      handleChange([...current, option]);
                    } else {
                      handleChange(current.filter((v: string) => v !== option));
                    }
                  }}
                  className="mr-2"
                  aria-label={option}
                />
                {option}
              </label>
            ))}
          </div>
        );

      case "file_upload":
        return (
          <input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleChange(file.name);
              }
            }}
            className="w-full px-3 py-2 bg-muted dark:bg-card border border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
            aria-label={question.label}
          />
        );

      case "photo_upload":
        return (
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleChange(file.name);
              }
            }}
            className="w-full px-3 py-2 bg-muted dark:bg-card border border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
            aria-label={question.label}
          />
        );

      default:
        return (
          <p className="text-muted-foreground">Unsupported question type</p>
        );
    }
  };

  if (loading || loadingInterview) return <p>Loading...</p>;
  if (!session) return null;
  if (!interview) return <p>Interview not found</p>;
  if (!template) return <p>Template not found</p>;

  const currentSection = template.sections[currentSectionIndex];
  const visibleQuestions = currentSection.questions.filter((q) => {
    if (!q.conditional) return true;
    const { dependsOn, operator, value } = q.conditional;
    const dependentValue = responses[dependsOn];
    switch (operator) {
      case "equals":
        return dependentValue === value;
      case "not_equals":
        return dependentValue !== value;
      case "contains":
        return Array.isArray(dependentValue)
          ? dependentValue.includes(value)
          : String(dependentValue).includes(value);
      case "greater_than":
        return Number(dependentValue) > Number(value);
      case "less_than":
        return Number(dependentValue) < Number(value);
      default:
        return true;
    }
  });

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <button
            onClick={() => router.push("/admin/interviews")}
            className="text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            ← Back to Interviews
          </button>
          <h1 className="text-2xl font-bold text-foreground">
            {interview.interviewNumber}
          </h1>
          <p className="text-sm text-muted-foreground">{template.name}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowStatusDialog(true)}
            className="px-4 py-2 bg-info text-foreground rounded hover:bg-info"
          >
            Change Status
          </button>
          {interview.status === "completed" && (
            <button
              onClick={generateClaim}
              className="px-4 py-2 bg-success text-foreground rounded hover:bg-success"
            >
              Generate Claim
            </button>
          )}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {/* Status Banner */}
      <div className="mb-6 p-4 bg-surface rounded shadow">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-muted-foreground">Status</span>
            <div className="mt-1">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[interview.status]}`}
              >
                {STATUS_LABELS[interview.status]}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm text-muted-foreground">Progress</span>
            <div className="mt-1 text-sm font-medium">
              {Math.round(interview.progress)}%
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {template.settings.showProgress && (
        <div className="mb-6">
          <div
            className="w-full bg-muted rounded-full h-2"
            role="progressbar"
            aria-label="Interview progress"
            aria-valuenow={Math.round(interview.progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="bg-info h-2 rounded-full transition-all"
              style={{
                width: `${interview.progress}%`,
              }} /* eslint-disable-line react/no-inline-styles */
              role="presentation"
            ></div>
          </div>
        </div>
      )}

      {/* Section Navigation */}
      {template.settings.showSectionNavigation && (
        <div className="mb-6 p-4 bg-surface rounded shadow">
          <h2 className="text-lg font-semibold mb-4">Sections</h2>
          <div className="flex flex-wrap gap-2">
            {template.sections.map((section, index) => (
              <button
                key={section.id}
                onClick={() => setCurrentSectionIndex(index)}
                className={`px-4 py-2 rounded ${currentSectionIndex === index ? "bg-blue-600 text-white" : "bg-muted text-foreground hover:bg-muted"}`}
              >
                {section.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Question Runner */}
      <div className="bg-surface rounded shadow p-6">
        <h2 className="text-lg font-semibold mb-2">{currentSection.title}</h2>
        {currentSection.description && (
          <p className="text-sm text-muted-foreground mb-6">
            {currentSection.description}
          </p>
        )}

        <div className="space-y-6">
          {visibleQuestions.map((question) => (
            <div key={question.id} className="border-b border pb-6">
              <div className="mb-2">
                <label className="block text-sm font-medium text-foreground">
                  {question.label}
                  {question.required && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </label>
                {question.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {question.description}
                  </p>
                )}
              </div>
              {renderQuestionInput(
                question,
                responses[question.id],
                currentSection.id,
              )}
            </div>
          ))}
        </div>

        {/* Navigation Buttons */}
        <div className="mt-6 flex justify-between">
          <button
            onClick={() =>
              setCurrentSectionIndex(Math.max(0, currentSectionIndex - 1))
            }
            disabled={currentSectionIndex === 0}
            className="px-4 py-2 bg-muted text-foreground rounded hover:bg-accent disabled:opacity-50"
          >
            Previous Section
          </button>
          <button
            onClick={() =>
              setCurrentSectionIndex(
                Math.min(template.sections.length - 1, currentSectionIndex + 1),
              )
            }
            disabled={currentSectionIndex === template.sections.length - 1}
            className="px-4 py-2 bg-info text-foreground rounded hover:bg-info disabled:opacity-50"
          >
            Next Section
          </button>
        </div>
      </div>

      {/* Status Change Dialog */}
      {showStatusDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-surface rounded p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold mb-4">Change Status</h2>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as InterviewStatus)}
              className="w-full px-3 py-2 bg-muted dark:bg-card border border-input rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary mb-4"
              aria-label="Select new status"
            >
              <option value="draft">Draft</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleStatusChange}
                className="flex-1 px-4 py-2 bg-info text-foreground rounded hover:bg-info"
              >
                Save
              </button>
              <button
                onClick={() => setShowStatusDialog(false)}
                className="flex-1 px-4 py-2 bg-muted text-foreground rounded hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
