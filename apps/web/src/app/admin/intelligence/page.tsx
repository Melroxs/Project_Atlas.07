"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { notifyDemoChanged } from "@/lib/demo-events";
import { useVoiceContext } from "@project-atlas/voice";
import AskAtlas from "@/components/intelligence/AskAtlas";
import BusinessInsights from "@/components/intelligence/BusinessInsights";
import Recommendations from "@/components/intelligence/Recommendations";
import LearningStats from "@/components/intelligence/LearningStats";
import EvidenceGraph from "@/components/demo/EvidenceGraph";
import PhotoIntelligence from "@/components/demo/PhotoIntelligence";
import DecisionReview from "@/components/demo/DecisionReview";
import TimelinePlayback from "@/components/demo/TimelinePlayback";

type TabId = "ask" | "insights" | "recommendations" | "learning" | "claim";

const tabs: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "ask", label: "Ask Atlas", icon: "🤖" },
  { id: "insights", label: "Insights", icon: "📊" },
  { id: "recommendations", label: "Recommendations", icon: "💡" },
  { id: "learning", label: "Learning", icon: "🧠" },
  { id: "claim", label: "Claim Intelligence", icon: "🕸️" },
];

export default function IntelligencePage() {
  const [activeTab, setActiveTab] = useState<TabId>("ask");
  const [flagshipClaimId, setFlagshipClaimId] = useState<string | null>(null);

  // Tell the voice assistant we're in the Intelligence Center (Evidence
  // Graph, Photo Intelligence, Decision Review) so commands like
  // "run the evidence graph" resolve to this module.
  useVoiceContext({ mode: "evidence", page: "/admin/intelligence" });

  // Resolve the flagship claim so the timeline can deep-link into it.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = (await apiFetch("/demo/claims")) as {
          claims?: Array<{ id: string; claimNumber: string }>;
        };
        const claims = response?.claims || [];
        const flagship =
          claims.find((c) => c.claimNumber === "CL-2026-0614") || claims[0];
        if (active && flagship?.id) setFlagshipClaimId(flagship.id);
      } catch {
        /* demo data may not exist — timeline falls back to the canonical story */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <div className="text-4xl">🧠</div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Atlas Intelligence
          </h1>
          <p className="text-muted-foreground">
            AI Operating System for Insurance Restoration
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-4 py-3 font-medium transition-colors ${activeTab === tab.id ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "ask" && <AskAtlas />}
      {activeTab === "insights" && <BusinessInsights />}
      {activeTab === "recommendations" && <Recommendations />}
      {activeTab === "learning" && <LearningStats />}

      {/* Claim Intelligence — live demo modules, animated while data changes */}
      {activeTab === "claim" && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-surface p-5">
            <h2 className="text-lg font-semibold text-foreground">
              Live Claim Intelligence
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              The Carter Residence wind &amp; hail claim — evidence graph, photo
              analysis, decision explainability and timeline. Everything animates
              and updates live as the demo runs.
            </p>
          </div>

          <EvidenceGraph />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <PhotoIntelligence />
            <DecisionReview onRefresh={() => notifyDemoChanged()} />
          </div>

          <TimelinePlayback claimId={flagshipClaimId} />
        </div>
      )}
    </div>
  );
}
