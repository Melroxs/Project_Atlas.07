"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: Array<{
    name: string;
    status: "pass" | "fail" | "warn";
    message: string;
    duration?: number;
    metadata?: Record<string, any>;
  }>;
}

interface DiagnosticsData {
  systemInfo: {
    applicationVersion: string;
    gitCommitHash: string;
    deploymentEnvironment: string;
    buildDate: string;
    nodeVersion: string;
    platform: string;
  };
  deploymentReadiness: {
    buildPassing: boolean;
    lintPassing: boolean;
    typecheckPassing: boolean;
    apiConnected: boolean;
    databaseConnected: boolean;
    storageConnected: boolean;
    aiConnected: boolean;
    authenticationWorking: boolean;
    demoModeWorking: boolean;
    noCriticalErrors: boolean;
  };
  backgroundJobs: {
    status: "running" | "stopped" | "error";
    activeJobs: number;
    queueSize: number;
  };
  workerStatus: {
    status: "healthy" | "degraded" | "unhealthy";
    activeWorkers: number;
    totalWorkers: number;
  };
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  responseTime: {
    average: number;
    p95: number;
    p99: number;
  };
  averageApiLatency: number;
  environmentVariables: {
    [key: string]: "set" | "not set";
  };
  healthWarnings: string[];
}

export default function SystemHealthPage() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "health" | "readiness" | "diagnostics"
  >("overview");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [healthResponse, diagnosticsResponse] = await Promise.all([
        apiFetch("/intelligence/health"),
        apiFetch("/intelligence/diagnostics"),
      ]);
      setHealthStatus(healthResponse as HealthStatus);
      setDiagnostics(diagnosticsResponse as DiagnosticsData);
    } catch (error) {
      console.error("Error fetching system health data:", error);
    } finally {
      setLoading(false);
    }
  };

  const runHealthCheck = async (checkName: string) => {
    try {
      const response = await apiFetch(
        `/intelligence/health/check/${checkName}`,
      );
      await fetchData();
    } catch (error) {
      console.error("Error running health check:", error);
    }
  };

  const clearCache = async () => {
    try {
      await apiFetch("/intelligence/diagnostics/clear-cache", {
        method: "POST",
      });
      await fetchData();
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  };

  const refreshHealth = async () => {
    try {
      await apiFetch("/intelligence/diagnostics/refresh-health", {
        method: "POST",
      });
      await fetchData();
    } catch (error) {
      console.error("Error refreshing health:", error);
    }
  };

  const exportDiagnostics = async () => {
    try {
      const response = (await apiFetch(
        "/intelligence/diagnostics/export",
      )) as string;
      const blob = new Blob([response], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `atlas-diagnostics-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting diagnostics:", error);
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-success/10 text-green-800";
      case "degraded":
        return "bg-warning/10 text-warning";
      case "unhealthy":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-foreground";
    }
  };

  const getCheckStatusColor = (status: string) => {
    switch (status) {
      case "pass":
        return "text-success";
      case "fail":
        return "text-destructive";
      case "warn":
        return "text-warning";
      default:
        return "text-muted-foreground";
    }
  };

  const getCheckStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
        return "✅";
      case "fail":
        return "❌";
      case "warn":
        return "⚠️";
      default:
        return "❓";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce animate-delay-0" />
          <div className="w-3 h-3 bg-accent rounded-full animate-bounce animate-delay-150" />
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce animate-delay-300" />
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "health" as const, label: "Health Checks" },
    { id: "readiness" as const, label: "Deployment Readiness" },
    { id: "diagnostics" as const, label: "Diagnostics" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <div className="text-4xl">🏥</div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            System Health Center
          </h1>
          <p className="text-muted-foreground">
            Administrator-only system monitoring and diagnostics
          </p>
        </div>
      </div>

      {/* Overall Status */}
      {healthStatus && (
        <div
          className={`p-4 rounded-xl ${getHealthStatusColor(healthStatus.status)}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                System Status: {healthStatus.status.toUpperCase()}
              </h2>
              <p className="text-sm opacity-80">
                Last updated:{" "}
                {new Date(healthStatus.timestamp).toLocaleString()}
              </p>
            </div>
            <button
              onClick={refreshHealth}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-2 border-b border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 font-medium transition-colors ${activeTab === tab.id ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && diagnostics && (
        <div className="space-y-6">
          {/* System Info */}
          <div className="bg-surface rounded-xl border p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              System Information
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  Application Version
                </p>
                <p className="font-semibold text-foreground">
                  {diagnostics.systemInfo.applicationVersion}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Git Commit</p>
                <p className="font-semibold text-foreground font-mono text-sm">
                  {diagnostics.systemInfo.gitCommitHash}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Environment</p>
                <p className="font-semibold text-foreground">
                  {diagnostics.systemInfo.deploymentEnvironment}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Build Date</p>
                <p className="font-semibold text-foreground">
                  {new Date(
                    diagnostics.systemInfo.buildDate,
                  ).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Node Version</p>
                <p className="font-semibold text-foreground">
                  {diagnostics.systemInfo.nodeVersion}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Platform</p>
                <p className="font-semibold text-foreground">
                  {diagnostics.systemInfo.platform}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Memory Usage</p>
              <p className="text-2xl font-bold text-foreground">
                {diagnostics.memoryUsage.percentage}%
              </p>
              <p className="text-xs text-muted-foreground">
                {diagnostics.memoryUsage.used}MB /{" "}
                {diagnostics.memoryUsage.total}MB
              </p>
            </div>
            <div className="bg-surface rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">API Latency</p>
              <p className="text-2xl font-bold text-foreground">
                {diagnostics.averageApiLatency}ms
              </p>
              <p className="text-xs text-muted-foreground">
                Average response time
              </p>
            </div>
            <div className="bg-surface rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Active Workers</p>
              <p className="text-2xl font-bold text-foreground">
                {diagnostics.workerStatus.activeWorkers}
              </p>
              <p className="text-xs text-muted-foreground">
                of {diagnostics.workerStatus.totalWorkers} total
              </p>
            </div>
            <div className="bg-surface rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Queue Size</p>
              <p className="text-2xl font-bold text-foreground">
                {diagnostics.backgroundJobs.queueSize}
              </p>
              <p className="text-xs text-muted-foreground">
                {diagnostics.backgroundJobs.activeJobs} active jobs
              </p>
            </div>
          </div>

          {/* Health Warnings */}
          {diagnostics.healthWarnings.length > 0 && (
            <div className="bg-warning/10 border-warning/30 rounded-xl p-4">
              <h3 className="font-semibold text-warning mb-2">
                Health Warnings
              </h3>
              <ul className="space-y-1">
                {diagnostics.healthWarnings.map((warning, index) => (
                  <li key={index} className="text-warning text-sm">
                    ⚠️ {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {activeTab === "health" && healthStatus && (
        <div className="space-y-4">
          <div className="bg-surface rounded-xl border p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Health Checks
            </h2>
            <div className="space-y-3">
              {healthStatus.checks.map((check, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-muted rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">
                      {getCheckStatusIcon(check.status)}
                    </span>
                    <div>
                      <p className="font-semibold text-foreground">
                        {check.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {check.message}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${getCheckStatusColor(check.status)}`}
                    >
                      {check.status.toUpperCase()}
                    </p>
                    {check.duration && (
                      <p className="text-xs text-muted-foreground">
                        {check.duration}ms
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Individual Test Buttons */}
          <div className="bg-surface rounded-xl border p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Run Individual Tests
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                "database",
                "storage",
                "ai",
                "authentication",
                "api",
                "demo",
              ].map((check) => (
                <button
                  key={check}
                  onClick={() => runHealthCheck(check)}
                  className="px-4 py-3 bg-muted hover:bg-muted border rounded-lg font-medium transition-colors"
                >
                  Test {check.charAt(0).toUpperCase() + check.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "readiness" && diagnostics && (
        <div className="space-y-6">
          <div className="bg-surface rounded-xl border p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Deployment Readiness Checklist
            </h2>
            <div className="space-y-3">
              {Object.entries(diagnostics.deploymentReadiness).map(
                ([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">{value ? "✅" : "❌"}</span>
                      <p className="font-medium text-foreground capitalize">
                        {key.replace(/([A-Z])/g, "$1").trim()}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-medium ${value ? "text-green-600" : "text-red-600"}`}
                    >
                      {value ? "Passing" : "Failing"}
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Environment Variables */}
          <div className="bg-surface rounded-xl border p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Environment Variables
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(diagnostics.environmentVariables).map(
                ([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <p className="font-mono text-sm text-foreground">{key}</p>
                    <span
                      className={`text-sm font-medium ${value === "set" ? "text-green-600" : "text-red-600"}`}
                    >
                      {value}
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "diagnostics" && diagnostics && (
        <div className="space-y-6">
          {/* Response Time Metrics */}
          <div className="bg-surface rounded-xl border p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Response Time Metrics
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-xs text-muted-foreground">Average</p>
                <p className="text-2xl font-bold text-foreground">
                  {diagnostics.responseTime.average}ms
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-xs text-muted-foreground">P95</p>
                <p className="text-2xl font-bold text-foreground">
                  {diagnostics.responseTime.p95}ms
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-xs text-muted-foreground">P99</p>
                <p className="text-2xl font-bold text-foreground">
                  {diagnostics.responseTime.p99}ms
                </p>
              </div>
            </div>
          </div>

          {/* Admin Tools */}
          <div className="bg-surface rounded-xl border p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Admin Tools
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <button
                onClick={clearCache}
                className="px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors"
              >
                Clear Cache
              </button>
              <button
                onClick={refreshHealth}
                className="px-4 py-3 bg-accent hover:bg-accent/90 text-white rounded-lg font-medium transition-colors"
              >
                Refresh Health
              </button>
              <button
                onClick={exportDiagnostics}
                className="px-4 py-3 bg-muted hover:bg-muted border rounded-lg font-medium transition-colors"
              >
                Export Diagnostics
              </button>
            </div>
          </div>

          {/* Detailed Info */}
          <div className="bg-surface rounded-xl border p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Detailed Information
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-foreground mb-2">
                  Background Jobs
                </h3>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Status: {diagnostics.backgroundJobs.status}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Active Jobs: {diagnostics.backgroundJobs.activeJobs}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Queue Size: {diagnostics.backgroundJobs.queueSize}
                  </p>
                </div>
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-2">
                  Worker Status
                </h3>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Status: {diagnostics.workerStatus.status}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Active Workers: {diagnostics.workerStatus.activeWorkers}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Total Workers: {diagnostics.workerStatus.totalWorkers}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
