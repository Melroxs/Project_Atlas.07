import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/atlas/PageHeader";
import { StatusPill } from "@/components/atlas/StatusPill";
import { Bell, CheckCheck, Filter } from "lucide-react";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Atlas" }] }),
  component: NotificationsPage,
});

const NOTES = [
  { time: "2m ago", title: "New adjuster response on ATL-2847", body: "Ryan Chen (State Farm) approved supplement items 1–4.", tone: "green" as const, unread: true },
  { time: "18m ago", title: "Atlas generated 3 supplements overnight", body: "Ready for your review in the Supplements queue.", tone: "cyan" as const, unread: true },
  { time: "44m ago", title: "Document OCR complete", body: "12 policy PDFs processed and indexed.", tone: "blue" as const, unread: true },
  { time: "1h ago", title: "Task overdue", body: "Follow up with adjuster Chen on ATL-2847.", tone: "amber" as const, unread: true },
  { time: "2h ago", title: "New claim assigned", body: "NPP-2026-0848 from State Farm was added to your queue.", tone: "purple" as const, unread: false },
  { time: "5h ago", title: "Weekly recovery report ready", body: "$127.5K recovered · 87% approval rate.", tone: "green" as const, unread: false },
  { time: "Yesterday", title: "Property inspection completed", body: "Denver hail damage report uploaded with 24 photos.", tone: "cyan" as const, unread: false },
];

function NotificationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Everything Atlas has noticed on your behalf."
        actions={
          <>
            <button className="h-9 px-3 rounded-lg border border-white/10 bg-white/[0.02] text-xs flex items-center gap-2"><Filter className="h-3.5 w-3.5" /> All</button>
            <button className="h-9 px-3 rounded-lg border border-white/10 bg-white/[0.02] text-xs flex items-center gap-2"><CheckCheck className="h-3.5 w-3.5" /> Mark all read</button>
          </>
        }
      />

      <div className="glass rounded-2xl divide-y divide-white/5">
        {NOTES.map((n, i) => {
          const icon = {
            cyan: "bg-cyan/10 text-cyan",
            purple: "bg-purple/10 text-purple",
            green: "bg-green/10 text-green",
            blue: "bg-blue/10 text-blue",
            amber: "bg-amber-400/10 text-amber-300",
          }[n.tone];
          return (
            <div key={i} className={`px-5 py-4 flex gap-4 hover:bg-white/[0.02] transition ${n.unread ? "" : "opacity-70"}`}>
              <div className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${icon}`}>
                <Bell className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{n.title}</p>
                  {n.unread && <span className="h-1.5 w-1.5 rounded-full bg-cyan shadow-[0_0_6px_currentColor]" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                <p className="text-[11px] text-muted-foreground mt-2">{n.time}</p>
              </div>
              <StatusPill tone={n.tone}>{n.tone === "green" ? "Done" : n.tone === "amber" ? "Action" : "Info"}</StatusPill>
            </div>
          );
        })}

      </div>
    </>
  );
}
