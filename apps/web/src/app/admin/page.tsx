"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/providers/SupabaseProvider";
import { apiFetch } from "@/lib/api";
import AskAtlas from "@/components/intelligence/AskAtlas";
import NewProjectDialog from "@/components/projects/NewProjectDialog";

export default function HomePage() {
  const { session, loading } = useSupabase();
  const router = useRouter();
  const [showNewProject, setShowNewProject] = useState(false);

  useEffect(() => {
    if (!session) {
      router.push("/login");
      return;
    }
    const checkDemoStatus = async () => {
      try {
        const response = await apiFetch("/demo/status");
        const status = response as { enabled: boolean };
        if (status.enabled) {
          router.push("/admin/demo");
        }
      } catch (error) {
        // Demo endpoint might not be available, ignore error
      }
    };
    checkDemoStatus();
  }, [session, router]);

  if (loading || !session) return null;

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
      <NewProjectDialog
        open={showNewProject}
        onClose={() => setShowNewProject(false)}
      />
    </>
  );
}
