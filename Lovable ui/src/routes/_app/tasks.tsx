import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/atlas/PageHeader";
import { AtlasInsights } from "@/components/atlas/AtlasInsights";
import { StatusPill } from "@/components/atlas/StatusPill";
import { Plus, MoreHorizontal, Calendar, User, Flag } from "lucide-react";

export const Route = createFileRoute("/_app/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Atlas" }] }),
  component: TasksPage,
});

const COLUMNS = [
  {
    title: "Today", tone: "cyan" as const, tasks: [
      { title: "Follow up with adjuster Chen on ATL-2847", priority: "High", tone: "rose" as const, due: "Today 2:00 PM", assignee: "MO", claim: "ATL-2847" },
      { title: "Upload drone photos to Miller residence", priority: "Medium", tone: "amber" as const, due: "Today 4:30 PM", assignee: "DR", claim: "NPP-2026-0837" },
      { title: "Review supplement SUP-2846 before submission", priority: "High", tone: "rose" as const, due: "Today", assignee: "MO", claim: "SUP-2846" },
    ]
  },
  {
    title: "This Week", tone: "purple" as const, tasks: [
      { title: "Schedule site visit for Farmers claim", priority: "Medium", tone: "amber" as const, due: "Thu Jul 17", assignee: "JS", claim: "NPP-2026-0821" },
      { title: "Send policy request to Liberty Mutual", priority: "Low", tone: "muted" as const, due: "Fri Jul 18", assignee: "MO", claim: "NPP-2026-0803" },
      { title: "Interview homeowner — Portland property", priority: "Medium", tone: "amber" as const, due: "Fri Jul 18", assignee: "DR", claim: "NPP-2026-0803" },
      { title: "Prepare Q3 recovery report for leadership", priority: "Low", tone: "muted" as const, due: "Sun Jul 20", assignee: "MO", claim: "—" },
    ]
  },
  {
    title: "Blocked", tone: "amber" as const, tasks: [
      { title: "Waiting for updated estimate from field team", priority: "High", tone: "rose" as const, due: "Blocked 2d", assignee: "JS", claim: "NPP-2026-0815" },
      { title: "Awaiting Allstate response on supplement", priority: "Medium", tone: "amber" as const, due: "Blocked 4d", assignee: "MO", claim: "NPP-2026-0837" },
    ]
  },
  {
    title: "Done", tone: "green" as const, tasks: [
      { title: "Approved supplement submitted to Liberty Mutual", priority: "Low", tone: "muted" as const, due: "Yesterday", assignee: "MO", claim: "NPP-2026-0803" },
      { title: "OCR reprocessed on 12 policy documents", priority: "Low", tone: "muted" as const, due: "Yesterday", assignee: "AI", claim: "—" },
    ]
  },
];

function TasksPage() {
  return (
    <>
      <PageHeader
        eyebrow="Workflow"
        title="Tasks"
        description="Atlas surfaces the highest-leverage next steps across your book."
        actions={
          <button className="h-9 px-3 rounded-lg bg-gradient-cyan text-primary-foreground text-xs font-medium flex items-center gap-2">
            <Plus className="h-3.5 w-3.5" /> New task
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {COLUMNS.map((col) => (
          <div key={col.title} className="glass rounded-2xl p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <StatusPill tone={col.tone}>{col.title}</StatusPill>
                <span className="text-xs text-muted-foreground">{col.tasks.length}</span>
              </div>
              <button className="text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-3.5 w-3.5" /></button>
            </div>
            <div className="flex-1 space-y-3">
              {col.tasks.map((t, i) => (
                <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 hover:border-cyan/20 cursor-pointer transition">
                  <div className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1 h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-cyan" />
                    <p className="text-sm leading-snug flex-1">{t.title}</p>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Flag className={`h-3 w-3 ${t.tone === "rose" ? "text-rose-300" : t.tone === "amber" ? "text-amber-300" : ""}`} />{t.priority}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{t.due}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-[10px] text-cyan">{t.claim}</span>
                    <div className="h-6 w-6 rounded-full bg-gradient-purple grid place-items-center text-[9px] font-semibold text-primary-foreground">{t.assignee}</div>
                  </div>
                </div>
              ))}
              <button className="w-full py-2 text-[11px] text-muted-foreground hover:text-cyan transition flex items-center justify-center gap-1">
                <Plus className="h-3 w-3" /> Add task
              </button>
            </div>
          </div>
        ))}
      </div>

      <AtlasInsights
        items={[
          { text: "Atlas suggests prioritizing the 3 High tasks in Today — they unblock $12,400 in recovery.", tone: "cyan" },
          { text: "David Reyes has 5 open tasks — consider reassigning 2 to balance workload.", tone: "purple" },
          { text: "Auto-generated 4 tasks from yesterday's Ask Atlas requests.", tone: "green" },
        ]}
      />
    </>
  );
}
