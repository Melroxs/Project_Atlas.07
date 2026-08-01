"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useSupabase } from "@/providers/SupabaseProvider";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  ClaimStatus,
} from "@/lib/claims-workflow";
import ClaimWorkspace from "@/components/projects/ClaimWorkspace";
import ClaimIntelligence from "@/components/projects/ClaimIntelligence";
import OperationsPanel from "@/components/operations/OperationsPanel";
import { ENTRY_POINTS, EntryPoint } from "@/lib/workflow-engine";

interface Claim {
  id: string;
  claimNumber: string;
  status: ClaimStatus;
  entryPoint?: EntryPoint | null;
  dateOfLoss: string | null;
  dateReported: string | null;
  insuranceCompany: string | null;
  policyNumber: string | null;
  deductible: number | null;
  estimatedValue: number | null;
  approvedValue: number | null;
  description: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  adjusterId: string | null;
  propertyId: string | null;
  statusHistory: any[];
  financialSummary: any;
  createdAt: string;
  updatedAt: string;
}

interface Supplement {
  id: string;
  supplementNumber: string;
  version: number;
  status: string;
  carrier: string | null;
  requestedAmount: number | null;
  approvedAmount: number | null;
  difference: number | null;
  createdAt: string;
}

interface SupplementsResponse {
  supplements: Supplement[];
  summary: {
    count: number;
    totalRequested: number;
    totalApproved: number;
    totalOutstanding: number;
    latestStatus: string | null;
    latestCarrierResponse: string | null;
  };
}

interface Interview {
  id: string;
  interviewNumber: string;
  templateName: string;
  status: string;
  progress: number;
  createdAt: string;
}

interface InterviewsResponse {
  interviews: Interview[];
  count: number;
}

interface StatusTransition {
  value: string;
  label: string;
}

interface TransitionResponse {
  currentStatus: string;
  nextStatuses: StatusTransition[];
}

const formatCurrency = (value: number | null) => {
  if (value === null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

const formatDate = (date: string | null) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function ClaimDetailPage() {
  const { session, loading } = useSupabase();
  const router = useRouter();
  const params = useParams();
  const claimId = params.id as string;

  const [claim, setClaim] = useState<Claim | null>(null);
  const [transitions, setTransitions] = useState<TransitionResponse | null>(
    null,
  );
  const [supplementsData, setSupplementsData] =
    useState<SupplementsResponse | null>(null);
  const [interviewsData, setInterviewsData] =
    useState<InterviewsResponse | null>(null);
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<"workspace" | "intelligence" | "operations">("workspace");
  const [error, setError] = useState("");
  const [loadingClaim, setLoadingClaim] = useState(true);

  useEffect(() => {
    if (!session) {
      router.push("/login");
      return;
    }
    loadClaim();
    loadTransitions();
    loadSupplements();
    loadInterviews();
  }, [session, router, claimId]);

  const loadClaim = async () => {
    try {
      setLoadingClaim(true);
      const data = await apiFetch<Claim>(`/claims/${claimId}`);
      setClaim(data);
    } catch (e: any) {
      setError(`Error loading claim: ${e.message}`);
    } finally {
      setLoadingClaim(false);
    }
  };

  const loadTransitions = async () => {
    try {
      const data = await apiFetch<TransitionResponse>(
        `/claims/${claimId}/transitions`,
      );
      setTransitions(data);
    } catch (e: any) {
      console.error("Error loading transitions:", e);
    }
  };

  const loadSupplements = async () => {
    try {
      const data = await apiFetch<SupplementsResponse>(
        `/claims/${claimId}/supplements`,
      );
      setSupplementsData(data);
    } catch (e: any) {
      console.error("Error loading supplements:", e);
    }
  };

  const loadInterviews = async () => {
    try {
      const data = await apiFetch<InterviewsResponse>(
        `/claims/${claimId}/interviews`,
      );
      setInterviewsData(data);
    } catch (e: any) {
      console.error("Error loading interviews:", e);
    }
  };

  const handleStatusChange = async () => {
    try {
      await apiFetch(`/claims/${claimId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status, reason }),
      });
      setShowStatusDialog(false);
      setStatus("");
      setReason("");
      loadClaim();
      loadTransitions();
    } catch (e: any) {
      setError(`Error updating status: ${e.message}`);
    }
  };

  if (loading || loadingClaim) return <p>Loading...</p>;
  if (!session) return null;
  if (!claim) return <p>Claim not found</p>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <button
            onClick={() => router.push("/admin/claims")}
            className="text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            ← Back to Claims
          </button>
          <h1 className="text-2xl font-bold text-foreground">
            {claim.claimNumber}
          </h1>
        </div>
        <button
          onClick={() => setShowStatusDialog(true)}
          className="px-4 py-2 bg-info text-foreground rounded hover:bg-info"
        >
          Change Status
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {/* Entry Point Badge */}
      {claim.entryPoint && claim.entryPoint !== "new_claim" && (
        <div className="mb-4 px-4 py-2 bg-muted/50 border rounded-lg inline-flex items-center gap-2 text-sm text-muted-foreground">
          <span className="text-lg">{ENTRY_POINTS[claim.entryPoint]?.icon}</span>
          <span className="font-medium text-foreground">
            {ENTRY_POINTS[claim.entryPoint]?.label}
          </span>
        </div>
      )}

      {/* Tabs: Workspace | Claim Intelligence | Operations */}
      <div className="mb-6 flex gap-2 border-b pb-3">
        <button
          onClick={() => setActiveTab("workspace")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "workspace"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          Claim Workspace
        </button>
        <button
          onClick={() => setActiveTab("intelligence")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "intelligence"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          Claim Intelligence
        </button>
        <button
          onClick={() => setActiveTab("operations")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "operations"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          Operations
        </button>
      </div>

      {/* Dynamic Claim Workspace / Claim Intelligence / Operations */}
      <div className="mb-6">
        {activeTab === "workspace" ? (
          <ClaimWorkspace claimId={claim.id} />
        ) : activeTab === "intelligence" ? (
          <ClaimIntelligence claimId={claim.id} />
        ) : (
          <OperationsPanel claimId={claim.id} />
        )}
      </div>

      {/* Status Banner */}
      <div className="mb-6 p-4 bg-surface rounded shadow">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-muted-foreground">
              Current Status
            </span>
            <div className="mt-1">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[claim.status]}`}
              >
                {STATUS_LABELS[claim.status]}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm text-muted-foreground">Last Updated</span>
            <div className="mt-1 text-sm font-medium">
              {formatDate(claim.updatedAt)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Claim Details */}
          <div className="bg-surface rounded shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Claim Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Date of Loss
                </label>
                <p className="mt-1 text-sm text-foreground">
                  {formatDate(claim.dateOfLoss)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Date Reported
                </label>
                <p className="mt-1 text-sm text-foreground">
                  {formatDate(claim.dateReported)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Insurance Company
                </label>
                <p className="mt-1 text-sm text-foreground">
                  {claim.insuranceCompany || "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Policy Number
                </label>
                <p className="mt-1 text-sm text-foreground">
                  {claim.policyNumber || "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Description
                </label>
                <p className="mt-1 text-sm text-foreground">
                  {claim.description || "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div className="bg-surface rounded shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Customer Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Name
                </label>
                <p className="mt-1 text-sm text-foreground">
                  {claim.customerName || "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Email
                </label>
                <p className="mt-1 text-sm text-foreground">
                  {claim.customerEmail || "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Phone
                </label>
                <p className="mt-1 text-sm text-foreground">
                  {claim.customerPhone || "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-surface rounded shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Financial Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Estimated Value
                </label>
                <p className="mt-1 text-sm text-foreground">
                  {formatCurrency(claim.estimatedValue)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Approved Value
                </label>
                <p className="mt-1 text-sm text-foreground">
                  {formatCurrency(claim.approvedValue)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Deductible
                </label>
                <p className="mt-1 text-sm text-foreground">
                  {formatCurrency(claim.deductible)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Net Approved
                </label>
                <p className="mt-1 text-sm text-foreground">
                  {formatCurrency(claim.financialSummary?.netApproved)}
                </p>
              </div>
            </div>
          </div>

          {/* Supplements Summary */}
          <div className="bg-surface rounded shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Supplements</h2>
            {supplementsData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Supplement Count
                  </label>
                  <p className="mt-1 text-sm text-foreground">
                    {supplementsData.summary.count}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Latest Status
                  </label>
                  <p className="mt-1 text-sm text-foreground">
                    {supplementsData.summary.latestStatus || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Total Requested
                  </label>
                  <p className="mt-1 text-sm text-foreground">
                    {formatCurrency(supplementsData.summary.totalRequested)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Total Approved
                  </label>
                  <p className="mt-1 text-sm text-foreground">
                    {formatCurrency(supplementsData.summary.totalApproved)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Outstanding Amount
                  </label>
                  <p className="mt-1 text-sm text-foreground">
                    {formatCurrency(supplementsData.summary.totalOutstanding)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Latest Carrier Response
                  </label>
                  <p className="mt-1 text-sm text-foreground">
                    {supplementsData.summary.latestCarrierResponse
                      ? formatDate(
                          supplementsData.summary.latestCarrierResponse,
                        )
                      : "N/A"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Loading supplements...
              </p>
            )}
          </div>

          {/* Interviews Summary */}
          <div className="bg-surface rounded shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Interviews</h2>
            {interviewsData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Interview Count
                  </label>
                  <p className="mt-1 text-sm text-foreground">
                    {interviewsData.count}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Latest Interview
                  </label>
                  <p className="mt-1 text-sm text-foreground">
                    {interviewsData.interviews.length > 0
                      ? interviewsData.interviews[0].interviewNumber
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Latest Status
                  </label>
                  <p className="mt-1 text-sm text-foreground">
                    {interviewsData.interviews.length > 0
                      ? interviewsData.interviews[0].status
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Latest Progress
                  </label>
                  <p className="mt-1 text-sm text-foreground">
                    {interviewsData.interviews.length > 0
                      ? `${Math.round(interviewsData.interviews[0].progress)}%`
                      : "N/A"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Loading interviews...
              </p>
            )}
          </div>

          {/* Status History */}
          <div className="bg-surface rounded shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Status History</h2>
            {claim.statusHistory && claim.statusHistory.length > 0 ? (
              <div className="space-y-3">
                {claim.statusHistory.map((entry: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-start space-x-3 p-3 bg-muted rounded"
                  >
                    <div className="flex-shrink-0 w-2 h-2 mt-2 bg-info rounded-full"></div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[entry.status as ClaimStatus]}`}
                        >
                          {STATUS_LABELS[entry.status as ClaimStatus]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {entry.userName && (
                        <p className="text-xs text-muted-foreground mt-1">
                          by {entry.userName}
                        </p>
                      )}
                      {entry.reason && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Reason: {entry.reason}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No status history available
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-surface rounded shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button className="w-full px-4 py-2 bg-muted text-foreground rounded hover:bg-muted text-left">
                View Documents
              </button>
              <button className="w-full px-4 py-2 bg-muted text-foreground rounded hover:bg-muted text-left">
                View Supplements
              </button>
              <button className="w-full px-4 py-2 bg-muted text-foreground rounded hover:bg-muted text-left">
                View Activity Timeline
              </button>
              <button className="w-full px-4 py-2 bg-muted text-foreground rounded hover:bg-muted text-left">
                Add Note
              </button>
            </div>
          </div>

          {/* Assigned Adjuster */}
          <div className="bg-surface rounded shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Assigned Adjuster</h2>
            {claim.adjusterId ? (
              <div>
                <p className="text-sm text-foreground">
                  Adjuster ID: {claim.adjusterId}
                </p>
                <button className="mt-2 text-sm text-info hover:text-blue-800">
                  View Adjuster Details
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No adjuster assigned
              </p>
            )}
          </div>

          {/* Property */}
          <div className="bg-surface rounded shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Property</h2>
            {claim.propertyId ? (
              <div>
                <p className="text-sm text-foreground">
                  Property ID: {claim.propertyId}
                </p>
                <button className="mt-2 text-sm text-info hover:text-blue-800">
                  View Property Details
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No property linked
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Status Change Dialog */}
      {showStatusDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Change Status</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  New Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full p-2 bg-muted dark:bg-card border border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
                  aria-label="Select new status"
                >
                  <option value="">Select status...</option>
                  {transitions?.nextStatuses.map((transition) => (
                    <option key={transition.value} value={transition.value}>
                      {transition.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Reason (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-2 bg-muted dark:bg-card border border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
                  rows={3}
                  placeholder="Enter reason for status change..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowStatusDialog(false);
                  setStatus("");
                  setReason("");
                }}
                className="px-4 py-2 bg-muted text-foreground rounded hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusChange}
                disabled={!status}
                className="px-4 py-2 bg-info text-foreground rounded hover:bg-info disabled:opacity-50"
              >
                Change Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
