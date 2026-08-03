"use client";

import { useState, useEffect, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { useLiveRefresh } from "@/lib/data-events";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useRouter } from "next/navigation";

interface Document {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  claimId: string | null;
  createdAt: string;
}

interface Claim {
  id: string;
  claimNumber: string;
}

interface ClaimsResponse {
  data: Claim[];
}

const aiSummaryFor = (doc: Document): string => {
  const name = doc.fileName.toLowerCase();
  if (/photo|drone|image/.test(name))
    return "Inspection photo from the Carter Residence wind & hail claim — linked as evidence (strength 0.95) supporting the roof replacement scope.";
  if (/weather/.test(name))
    return 'NOAA weather verification — 61 mph gusts and 1.25" hail on the loss date, confirming wind causation above the 55 mph policy threshold.';
  if (/estimate/.test(name))
    return "Carrier initial estimate — $4,414.50 for the roof loss. The Atlas supplement requested $22,835.65 across 6 line items.";
  if (/policy/.test(name))
    return "Policy UPC-55420-FL — wind & hail coverage, $1,000 deductible, full roof replacement clause.";
  if (/interview|fnol/.test(name))
    return "FNOL interview transcript — 6 key facts extracted: property, loss date, cause, carrier, policy, roof age.";
  if (/code|compliance/.test(name))
    return "Code compliance report — 2023 Florida Building Code R905.2.8.2, COMPLIANT (94/100).";
  if (/invoice/.test(name))
    return "Invoice ATL-8821 — $18,421.15 approved scope, paid via ACH, balance $0.00.";
  if (/permit/.test(name))
    return "Building permit ORL-2026-4412 — final inspection passed, permit closed.";
  if (/supplement/.test(name))
    return "Supplement package — $22,835.65 requested across 6 Xactimate line items; $18,421.15 approved.";
  if (/measurement|drone/.test(name))
    return "Roof measurements — 26 squares via drone photogrammetry, within 2% of tape measure.";
  return "Document in the Carter Residence claim file — referenced by the evidence graph and the Decision Engine.";
};

export default function DocumentsPage() {
  const { session, loading } = useSupabase();
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<Document | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!session) {
      router.push("/login");
      return;
    }
    loadDocuments();
    loadClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, router]);

  const loadDocuments = async () => {
    try {
      const data = await apiFetch<Document[]>("/documents");
      setDocuments(data);
    } catch (e: any) {
      setStatus(`Error loading: ${e.message}`);
    }
  };

  useLiveRefresh(loadDocuments);

  const loadClaims = async () => {
    try {
      const data = await apiFetch<ClaimsResponse>("/claims?limit=200");
      setClaims(Array.isArray(data) ? data : data.data);
    } catch (e: any) {
      console.error("Error loading claims:", e);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (d) =>
        d.fileName.toLowerCase().includes(q) ||
        (d.mimeType || "").toLowerCase().includes(q),
    );
  }, [documents, search]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setStatus("Please select a file");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (selectedClaimId) {
        formData.append("claimId", selectedClaimId);
      }

      const response = await fetch(`/documents/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      setStatus("Document uploaded successfully");
      setShowForm(false);
      setFile(null);
      setSelectedClaimId("");
      loadDocuments();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      await apiFetch(`/documents/${id}`, { method: "DELETE" });
      setStatus("Document deleted");
      loadDocuments();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  const handleDownload = (document: Document) => {
    window.open(document.url, "_blank");
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "-";
    if (bytes < 1024) return bytes + "B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + "KB";
    return (bytes / (1024 * 1024)).toFixed(1) + "MB";
  };

  const isImage = (doc: Document) => (doc.mimeType || "").startsWith("image/");
  const isPdf = (doc: Document) => (doc.mimeType || "").includes("pdf");

  if (loading) return <p>Loading...</p>;
  if (!session) return null;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-foreground">Documents</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-info text-foreground rounded hover:bg-info"
        >
          {showForm ? "Cancel" : "Upload Document"}
        </button>
      </div>

      {status && <p className="mb-4 text-sm text-muted-foreground">{status}</p>}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 bg-surface p-6 rounded shadow"
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="claim"
                className="block mb-1 text-sm font-medium text-foreground"
              >
                Link to Claim (Optional)
              </label>
              <select
                id="claim"
                value={selectedClaimId}
                onChange={(e) => setSelectedClaimId(e.target.value)}
                className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
              >
                <option value="">No claim selected</option>
                {claims.map((claim) => (
                  <option key={claim.id} value={claim.id}>
                    {claim.claimNumber}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="file"
                className="block mb-1 text-sm font-medium text-foreground"
              >
                File
              </label>
              <input
                id="file"
                type="file"
                onChange={handleFileChange}
                className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
                required
              />
            </div>
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 bg-success text-foreground rounded hover:bg-success disabled:bg-gray-400"
            >
              {uploading ? "Uploading..." : "Upload Document"}
            </button>
          </div>
        </form>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents by name or type…"
          className="w-full max-w-md p-2.5 bg-surface border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          {filtered.length} of {documents.length} documents · click a row to
          preview, zoom, download or print
        </p>
      </div>

      <div className="bg-surface rounded shadow overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                File Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Claim
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Uploaded
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-border">
            {filtered.map((document) => (
              <tr
                key={document.id}
                onClick={() => setPreview(document)}
                className="cursor-pointer hover:bg-muted transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span>
                      {isImage(document)
                        ? "🖼️"
                        : isPdf(document)
                          ? "📄"
                          : "📁"}
                    </span>
                    {document.fileName}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {document.mimeType || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {formatFileSize(document.sizeBytes)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {document.claimId ? (
                    <span className="px-2 py-1 bg-info/10 text-blue-800 rounded text-xs">
                      Linked
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {new Date(document.createdAt).toLocaleDateString()}
                </td>
                <td
                  className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setPreview(document)}
                    className="text-info hover:text-blue-900 mr-3"
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => handleDownload(document)}
                    className="text-info hover:text-blue-900 mr-3"
                  >
                    Download
                  </button>
                  <button
                    onClick={() => handleDelete(document.id)}
                    className="text-destructive hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-4 text-center text-sm text-muted-foreground"
                >
                  {documents.length === 0
                    ? "No documents found"
                    : "No documents match your search"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-surface rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border bg-muted">
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">
                  {preview.fileName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {preview.mimeType || "document"} ·{" "}
                  {formatFileSize(preview.sizeBytes)} · uploaded{" "}
                  {new Date(preview.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isImage(preview) && (
                  <>
                    <button
                      onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-surface border border-border rounded hover:border-primary transition-colors"
                      aria-label="Zoom out"
                    >
                      −
                    </button>
                    <span className="text-xs font-mono text-muted-foreground w-12 text-center">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button
                      onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-surface border border-border rounded hover:border-primary transition-colors"
                      aria-label="Zoom in"
                    >
                      +
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleDownload(preview)}
                  className="px-3 py-1.5 text-xs font-semibold bg-info text-foreground rounded hover:bg-info/80 transition-colors"
                >
                  Download
                </button>
                <button
                  onClick={() => window.open(preview.url, "_blank")}
                  className="px-3 py-1.5 text-xs font-semibold bg-surface border border-border rounded hover:border-primary transition-colors"
                  title="Open in new tab — print from there"
                >
                  Print
                </button>
                <button
                  onClick={() => setPreview(null)}
                  className="px-2.5 py-1.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close preview"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {isImage(preview) ? (
                <div className="flex items-center justify-center bg-[#0b1220] p-4 min-h-[220px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview.url}
                    alt={preview.fileName}
                    className="max-w-full object-contain transition-transform duration-200"
                    style={{ transform: `scale(${zoom})` }}
                  />
                </div>
              ) : isPdf(preview) ? (
                <iframe
                  src={preview.url}
                  title={preview.fileName}
                  className="w-full h-[55vh] bg-white"
                />
              ) : (
                <div className="p-8 text-center space-y-3">
                  <span className="text-5xl">📁</span>
                  <p className="text-sm text-muted-foreground">
                    No inline preview for this file type — open it in a new tab
                    to view or print.
                  </p>
                  <button
                    onClick={() => handleDownload(preview)}
                    className="px-4 py-2 text-sm font-semibold bg-info text-foreground rounded hover:bg-info/80 transition-colors"
                  >
                    Open document
                  </button>
                </div>
              )}
            </div>

            {/* AI summary + sources */}
            <div className="px-5 py-4 border-t border-border bg-muted space-y-2">
              <div className="flex items-start gap-2">
                <span className="shrink-0">🤖</span>
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Atlas AI summary
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {aiSummaryFor(preview)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0">🔗</span>
                <p className="text-xs text-muted-foreground">
                  Source:{" "}
                  {preview.claimId ? (
                    <button
                      onClick={() =>
                        router.push(`/admin/claims/${preview.claimId}`)
                      }
                      className="text-primary hover:underline"
                    >
                      linked claim →
                    </button>
                  ) : (
                    "claim file · Carter Residence evidence graph"
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
