"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
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

  useEffect(() => {
    if (!session) {
      router.push("/login");
      return;
    }
    loadDocuments();
    loadClaims();
  }, [session, router]);

  const loadDocuments = async () => {
    try {
      const data = await apiFetch<Document[]>("/documents");
      setDocuments(data);
    } catch (e: any) {
      setStatus(`Error loading: ${e.message}`);
    }
  };

  const loadClaims = async () => {
    try {
      const data = await apiFetch<ClaimsResponse>("/claims?limit=200");
      setClaims(Array.isArray(data) ? data : data.data);
    } catch (e: any) {
      console.error("Error loading claims:", e);
    }
  };

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

      // Upload always goes through /documents/upload; claimId travels in the
      // FormData so the API can link the document to the claim.
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

  if (loading) return <p>Loading...</p>;
  if (!session) return null;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
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
            {documents.map((document) => (
              <tr key={document.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {document.fileName}
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
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
            {documents.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-4 text-center text-sm text-muted-foreground"
                >
                  No documents found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
