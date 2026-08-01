"use client";

import { useSupabase } from "@/providers/SupabaseProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import OperationsDashboard from "@/components/operations/OperationsDashboard";

export default function OperationsPage() {
  const { session, loading } = useSupabase();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.push("/login");
    }
  }, [session, loading, router]);

  if (loading) return <p>Loading...</p>;
  if (!session) return null;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">
          Operations Intelligence
        </h1>
        <p className="text-muted-foreground mt-1">
          AI Case Manager dashboards — revenue recovery, executive operations,
          and portfolio intelligence across every active claim.
        </p>
      </div>
      <OperationsDashboard />
    </div>
  );
}
