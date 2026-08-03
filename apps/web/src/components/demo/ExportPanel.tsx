'use client';

// apps/web/src/components/demo/ExportPanel.tsx
// Export the demo story as Claim / Supplement / Decision / Evidence /
// Compliance reports, or the flagship one-click "Final Claim Package" that
// bundles the entire claim — in PDF (print dialog), Markdown or JSON.

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useDemoToast } from './DemoToast';
import { downloadZip, type ZipEntry } from '@/lib/zip-bundle';

type ReportType = 'claim' | 'supplement' | 'decision' | 'evidence' | 'compliance' | 'package';
type Format = 'markdown' | 'json' | 'pdf' | 'zip';

const REPORTS: Array<{ type: ReportType; label: string; icon: string; blurb: string }> = [
  { type: 'package', label: 'Final Claim Package', icon: '📦', blurb: 'Executive Summary · FNOL · Policy · Inspection · Photos · Weather · Evidence Graph · Decision · Compliance · Estimate · Supplement · Communications · Invoice · Permit · Timeline' },
  { type: 'claim', label: 'Claim Package', icon: '📄', blurb: 'Full claim record with scope, supplements, documents and timeline' },
  { type: 'supplement', label: 'Supplement Package', icon: '💰', blurb: 'Line items, cost breakdown and approval summary' },
  { type: 'decision', label: 'Decision Report', icon: '🧠', blurb: 'Scores, risk factors and reasoning trace' },
  { type: 'evidence', label: 'Evidence Report', icon: '🕸️', blurb: 'Evidence graph links and intelligence notes' },
  { type: 'compliance', label: 'Compliance Report', icon: '🛡️', blurb: 'Compliance status, validation checklist and risk assessment' },
];

const FORMATS: Array<{ format: Format; label: string; color: string }> = [
  { format: 'pdf', label: 'PDF', color: 'bg-[var(--color-error)] hover:bg-red-600' },
  { format: 'markdown', label: 'Markdown', color: 'bg-[var(--brand-purple)] hover:bg-[var(--brand-purple-light)]' },
  { format: 'json', label: 'JSON', color: 'bg-[var(--brand-cyan)] hover:bg-[var(--brand-cyan-light)]' },
  { format: 'zip', label: 'ZIP', color: 'bg-[var(--color-success)] hover:bg-green-600' },
];

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineBold(s: string) {
  return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
}

function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inList = false;
  let inTable = false;

  const close = () => {
    if (inList) { out.push('</ul>'); inList = false; }
    if (inTable) { out.push('</table>'); inTable = false; }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { close(); out.push(''); continue; }
    if (line.startsWith('|')) {
      const cells = line.split('|').filter((c) => c.trim() !== '').map((c) => inlineBold(escapeHtml(c.trim())));
      if (cells.some((c) => c.includes('---'))) continue;
      if (!inTable) { out.push('<table><thead><tr>' + cells.map((c) => `<th>${c}</th>`).join('') + '</tr></thead><tbody>'); inTable = true; }
      else out.push(`<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`);
      continue;
    }
    if (inTable) { out.push('</tbody></table>'); inTable = false; }
    if (line.startsWith('### ')) { close(); out.push(`<h3>${inlineBold(escapeHtml(line.slice(4)))}</h3>`); continue; }
    if (line.startsWith('## ')) { close(); out.push(`<h2>${inlineBold(escapeHtml(line.slice(3)))}</h2>`); continue; }
    if (line.startsWith('# ')) { close(); out.push(`<h1>${inlineBold(escapeHtml(line.slice(2)))}</h1>`); continue; }
    if (line.startsWith('- ')) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inlineBold(escapeHtml(line.slice(2)))}</li>`);
      continue;
    }
    close();
    out.push(`<p>${inlineBold(escapeHtml(line))}</p>`);
  }
  close();
  return out.join('\n');
}

export default function ExportPanel() {
  const toast = useDemoToast();
  const [busy, setBusy] = useState<string | null>(null);

  const download = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const printPdf = (title: string, html: string) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
      <style>
        body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #111; max-width: 800px; margin: 32px auto; padding: 0 24px; line-height: 1.55; }
        h1 { font-size: 24px; border-bottom: 2px solid #0e7490; padding-bottom: 8px; }
        h2 { font-size: 18px; margin-top: 28px; color: #0e7490; }
        h3 { font-size: 15px; margin-top: 20px; }
        table { border-collapse: collapse; width: 100%; margin: 12px 0; }
        th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 13px; }
        th { background: #f1f5f9; }
        ul { padding-left: 20px; }
        li { margin: 4px 0; }
        code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
        em { color: #666; }
      </style></head><body>${html}</body></html>`);
    doc.close();
    window.setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => document.body.removeChild(iframe), 2000);
    }, 350);
  };

  const handleExport = async (type: ReportType, format: Format) => {
    const key = `${type}-${format}`;
    setBusy(key);
    try {
      const res = await apiFetch<{
        filename: string;
        contentType: string;
        content: string;
        title: string;
        sections?: Array<{ title: string; filename: string; markdown: string }>;
      }>('/demo/export', {
        method: 'POST',
        body: JSON.stringify({ type, format: format === 'pdf' ? 'markdown' : format }),
      });

      if (format === 'zip' && res.sections?.length) {
        const entries: ZipEntry[] = [
          ...res.sections.map((s) => ({ name: s.filename, content: s.markdown })),
          {
            name: 'README.txt',
            content: `${res.title} — Carter Residence\nClaim CL-2026-0614 · generated by Atlas AI\n${res.sections.length} sections bundled by the Final Claim Package export.`,
          },
        ];
        downloadZip(res.filename, entries);
        toast.success(`${REPORTS.find((r) => r.type === type)?.label} exported as ZIP — ${res.sections.length} files`);
      } else if (format === 'pdf') {
        const html = markdownToHtml(res.content);
        printPdf(res.title, html);
        toast.success(`${REPORTS.find((r) => r.type === type)?.label} opened in print dialog — choose “Save as PDF”`);
      } else if (format === 'json') {
        download(res.filename, res.content, 'application/json');
        toast.success(`${REPORTS.find((r) => r.type === type)?.label} exported as JSON`);
      } else {
        download(res.filename, res.content, 'text/markdown; charset=utf-8');
        toast.success(`${REPORTS.find((r) => r.type === type)?.label} exported as Markdown`);
      }
    } catch (err) {
      console.error('Demo export error:', err);
      toast.error(
        type === 'package'
          ? 'Final package unavailable — generate demo data first'
          : 'Export unavailable — generate demo data first',
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--neutral-gray-200)] p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">Export Package</h2>
        <p className="text-sm text-[var(--neutral-gray-500)] mt-1">
          Ship the demo as carrier-ready documents — PDF, Markdown or JSON
        </p>
      </div>

      <div className="space-y-3">
        {REPORTS.map((report) => {
          const isPackage = report.type === 'package';
          return (
            <div
              key={report.type}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 ${
                isPackage
                  ? 'bg-gradient-to-r from-[var(--brand-purple)]/10 to-[var(--brand-cyan)]/10 border-[var(--brand-purple)]/40 shadow-md'
                  : 'bg-[var(--background-alt)] border-[var(--neutral-gray-200)]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-2xl ${isPackage ? '' : ''}`}>{report.icon}</span>
                <div className="min-w-0">
                  <p className={`font-semibold text-[var(--foreground)] ${isPackage ? 'text-base' : 'text-sm'}`}>
                    {report.label}
                    {isPackage && (
                      <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--brand-cyan)] text-white align-middle">
                        FLAGSHIP
                      </span>
                    )}
                  </p>
                  <p className={`text-xs text-[var(--neutral-gray-400)] mt-0.5 ${isPackage ? '' : 'hidden sm:block'}`}>
                    {isPackage ? report.blurb : 'Carter Residence — CL-2026-0614'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {FORMATS.filter((f) => isPackage || f.format !== 'zip').map((f) => (
                  <button
                    key={f.format}
                    onClick={() => handleExport(report.type, f.format)}
                    disabled={busy !== null}
                    title={isPackage && f.format === 'zip' ? 'Download the complete package as a multi-file ZIP' : undefined}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${f.color} ${isPackage ? 'px-4 py-2 text-sm' : ''} ${busy === `${report.type}-${f.format}` ? 'opacity-60' : ''}`}
                  >
                    {busy === `${report.type}-${f.format}` ? '…' : f.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
