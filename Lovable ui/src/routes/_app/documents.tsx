import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/atlas/PageHeader";
import { AtlasInsights } from "@/components/atlas/AtlasInsights";
import { StatusPill } from "@/components/atlas/StatusPill";
import { FileText, FileImage, FileSpreadsheet, FolderOpen, Upload, LayoutGrid, List, Sparkles, Search } from "lucide-react";

export const Route = createFileRoute("/_app/documents")({
  head: () => ({ meta: [{ title: "Documents — Atlas" }] }),
  component: DocumentsPage,
});

const DOCS = [
  { name: "Storm_Damage_Report_ATL-2847.pdf", type: "PDF", size: "4.2 MB", claim: "ATL-2847", ocr: true, summary: "Roof damage assessment across 12 zones with photo evidence.", icon: FileText, tone: "cyan" as const, updated: "2m ago" },
  { name: "Estimate_v3_Miller_Residence.xlsx", type: "Estimate", size: "780 KB", claim: "NPP-2026-0837", ocr: true, summary: "Line items with H/O 10-10 markup applied.", icon: FileSpreadsheet, tone: "green" as const, updated: "22m ago" },
  { name: "Adjuster_Notes_Chen.docx", type: "Notes", size: "94 KB", claim: "NPP-2026-0821", ocr: false, summary: "Field notes from adjuster site visit on 07/14.", icon: FileText, tone: "purple" as const, updated: "1h ago" },
  { name: "Roof_North_Elevation.jpg", type: "Image", size: "3.1 MB", claim: "ATL-2847", ocr: false, summary: "Drone photo · missing ridge cap identified.", icon: FileImage, tone: "blue" as const, updated: "1h ago" },
  { name: "Policy_Declaration_Allstate.pdf", type: "Policy", size: "1.8 MB", claim: "NPP-2026-0837", ocr: true, summary: "Policy limits and endorsements extracted.", icon: FileText, tone: "cyan" as const, updated: "3h ago" },
  { name: "Invoice_Materials_July.pdf", type: "Invoice", size: "220 KB", claim: "NPP-2026-0815", ocr: true, summary: "Materials invoice matched to project.", icon: FileText, tone: "amber" as const, updated: "1d ago" },
];

function DocumentsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Knowledge"
        title="Documents"
        description="Everything Atlas can read, summarize and reference across your claims."
        actions={
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input className="h-9 pl-9 pr-3 rounded-lg bg-white/[0.02] border border-white/10 text-xs w-64" placeholder="Search documents..." />
            </div>
            <div className="h-9 rounded-lg border border-white/10 bg-white/[0.02] flex">
              <button className="px-2.5 bg-cyan/10 text-cyan rounded-l-lg"><LayoutGrid className="h-3.5 w-3.5" /></button>
              <button className="px-2.5 text-muted-foreground rounded-r-lg"><List className="h-3.5 w-3.5" /></button>
            </div>
            <button className="h-9 px-3 rounded-lg bg-gradient-cyan text-primary-foreground text-xs font-medium flex items-center gap-2"><Upload className="h-3.5 w-3.5" /> Upload</button>
          </>
        }
      />

      {/* Dropzone */}
      <div className="glass rounded-2xl border-2 border-dashed border-white/10 hover:border-cyan/30 transition p-8 mb-8 text-center">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-cyan/10 grid place-items-center mb-3">
          <Upload className="h-6 w-6 text-cyan" />
        </div>
        <p className="text-sm font-medium">Drop documents to let Atlas read them</p>
        <p className="text-xs text-muted-foreground mt-1">PDF · DOCX · XLSX · Images. OCR runs automatically.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* File grid */}
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {DOCS.map((d) => {
            const Icon = d.icon;
            const icon = {
              cyan: "bg-cyan/10 text-cyan",
              blue: "bg-blue/10 text-blue",
              purple: "bg-purple/10 text-purple",
              green: "bg-green/10 text-green",
              amber: "bg-amber-400/10 text-amber-300",
            }[d.tone];
            return (
              <div key={d.name} className="group glass rounded-2xl p-4 hover:border-cyan/20 transition cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div className={`h-10 w-10 rounded-xl grid place-items-center ${icon}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  {d.ocr && (
                    <StatusPill tone="cyan"><Sparkles className="h-2.5 w-2.5" /> OCR</StatusPill>
                  )}
                </div>
                <p className="text-sm font-medium truncate">{d.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{d.type} · {d.size} · {d.claim}</p>
                <p className="text-xs text-muted-foreground mt-3 line-clamp-2 leading-relaxed">
                  <span className="text-cyan/90 font-medium">Atlas: </span>{d.summary}
                </p>
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{d.updated}</span>
                  <span className="opacity-0 group-hover:opacity-100 text-cyan transition">Preview →</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-6">
          <div className="glass rounded-2xl p-5">
            <p className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground font-medium mb-3">Folders</p>
            <ul className="space-y-1 text-sm">
              {[
                { name: "All documents", n: 812 },
                { name: "Estimates", n: 194 },
                { name: "Policies", n: 88 },
                { name: "Adjuster notes", n: 142 },
                { name: "Photos", n: 306 },
                { name: "Invoices", n: 82 },
              ].map((f, i) => (
                <li key={f.name} className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer ${i === 0 ? "bg-cyan/10 text-cyan" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"}`}>
                  <FolderOpen className="h-3.5 w-3.5" />
                  <span className="flex-1">{f.name}</span>
                  <span className="text-[11px]">{f.n}</span>
                </li>
              ))}
            </ul>
          </div>
          <AtlasInsights
            items={[
              { text: "3 estimates contain conflicting line items across the same claim.", tone: "purple" },
              { text: "Atlas has extracted 214 line items across your uploaded PDFs this week.", tone: "cyan" },
              { text: "1 policy is missing endorsements — flag for review.", tone: "green" },
            ]}
          />
        </div>
      </div>
    </>
  );
}
