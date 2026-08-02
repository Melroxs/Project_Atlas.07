"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import Image from "next/image";
import DemoMetrics from "@/components/demo/DemoMetrics";
import PersonaCards from "@/components/demo/PersonaCards";
import GuidedWalkthroughs from "@/components/demo/GuidedWalkthroughs";
import QuickActions from "@/components/demo/QuickActions";

interface DemoStatus {
  enabled: boolean;
  hasData: boolean;
  companyId: string | null;
}

export default function DemoExperiencePage() {
  const router = useRouter();
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkDemoStatus();
  }, []);

  const checkDemoStatus = async () => {
    try {
      const response = await apiFetch("/demo/status");
      setStatus(response as DemoStatus);
    } catch (error) {
      console.error("Error checking demo status:", error);
    } finally {
      setLoading(false);
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

  return (
    <div className="space-y-8">
      {/* Welcome Screen */}
      <div className="text-center space-y-4">
        <div className="relative w-24 h-24 mx-auto">
          <Image
            src="/brand/logo-icon.svg"
            alt="Project Atlas"
            fill
            className="object-contain"
          />
        </div>
        <h1 className="text-4xl font-bold text-foreground">
          Welcome to Project Atlas
        </h1>
        <p className="text-xl text-primary font-medium">
          AI Operating System for Insurance Restoration
        </p>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Choose a scenario below to experience how Atlas manages restoration
          projects from first contact through claim completion.
        </p>
        {!status?.hasData && (
          <p className="text-sm text-warning bg-warning/10 border border-warning/30 rounded-lg max-w-md mx-auto px-4 py-3">
            No demo data yet — use the <strong>Generate Demo Data</strong> button
            below to seed a realistic company with claims, supplements,
            documents, interviews, and activity.
          </p>
        )}
      </div>

      {/* Demo Metrics */}
      <DemoMetrics />

      {/* Persona Cards */}
      <PersonaCards />

      {/* Guided Walkthroughs */}
      <GuidedWalkthroughs />

      {/* Quick Actions */}
      <QuickActions />
    </div>
  );
}
