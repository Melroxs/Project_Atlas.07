"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useLiveRefresh } from "@/lib/data-events";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useRouter } from "next/navigation";

interface Adjuster {
  id: string;
  fullName: string;
  insuranceCompany: string | null;
  email: string | null;
  phone: string | null;
  office: string | null;
  territory: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
}

interface AdjustersResponse {
  data: Adjuster[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function AdjustersPage() {
  const { session, loading } = useSupabase();
  const router = useRouter();
  const [adjusters, setAdjusters] = useState<Adjuster[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    insuranceCompany: "",
    email: "",
    phone: "",
    office: "",
    territory: "",
    notes: "",
    active: true,
  });
  const [status, setStatus] = useState("");

  // Search and filter state
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    if (!session) {
      router.push("/login");
      return;
    }
    loadAdjusters();
  }, [session, router, search, activeFilter, page]);

  useLiveRefresh(() => loadAdjusters());

  const loadAdjusters = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (activeFilter) params.append("active", activeFilter);
      params.append("page", page.toString());
      params.append("limit", "20");

      const data = await apiFetch<AdjustersResponse>(
        `/adjusters?${params.toString()}`,
      );
      setAdjusters(data.data);
      setPagination(data.pagination);
    } catch (e: any) {
      setStatus(`Error loading: ${e.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiFetch(`/adjusters/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(formData),
        });
        setStatus("Adjuster updated");
      } else {
        await apiFetch("/adjusters", {
          method: "POST",
          body: JSON.stringify(formData),
        });
        setStatus("Adjuster created");
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({
        fullName: "",
        insuranceCompany: "",
        email: "",
        phone: "",
        office: "",
        territory: "",
        notes: "",
        active: true,
      });
      loadAdjusters();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  const handleEdit = (adjuster: Adjuster) => {
    setEditingId(adjuster.id);
    setFormData({
      fullName: adjuster.fullName,
      insuranceCompany: adjuster.insuranceCompany || "",
      email: adjuster.email || "",
      phone: adjuster.phone || "",
      office: adjuster.office || "",
      territory: adjuster.territory || "",
      notes: adjuster.notes || "",
      active: adjuster.active,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this adjuster?")) return;
    try {
      await apiFetch(`/adjusters/${id}`, { method: "DELETE" });
      setStatus("Adjuster deleted");
      loadAdjusters();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  const handleToggleActive = async (adjuster: Adjuster) => {
    try {
      await apiFetch(`/adjusters/${adjuster.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...adjuster, active: !adjuster.active }),
      });
      setStatus(`Adjuster ${adjuster.active ? "deactivated" : "activated"}`);
      loadAdjusters();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!session) return null;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">Adjusters</h1>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({
              fullName: "",
              insuranceCompany: "",
              email: "",
              phone: "",
              office: "",
              territory: "",
              notes: "",
              active: true,
            });
            setShowForm(!showForm);
          }}
          className="px-4 py-2 bg-info text-foreground rounded hover:bg-info"
        >
          {showForm ? "Cancel" : "Add Adjuster"}
        </button>
      </div>

      {status && <p className="mb-4 text-sm text-muted-foreground">{status}</p>}

      {/* Search and Filters */}
      <div className="mb-6 bg-surface p-4 rounded shadow flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by name, email, phone, insurance company..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
          />
        </div>
        <div>
          <select
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value);
              setPage(1);
            }}
            className="p-2 bg-muted dark:bg-card border-input rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
            aria-label="Filter by status"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 bg-surface p-6 rounded shadow"
        >
          <h2 className="text-lg font-semibold mb-4">
            {editingId ? "Edit Adjuster" : "New Adjuster"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="fullName"
                className="block mb-1 text-sm font-medium text-foreground"
              >
                Full Name *
              </label>
              <input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
                className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
                required
              />
            </div>
            <div>
              <label
                htmlFor="insuranceCompany"
                className="block mb-1 text-sm font-medium text-foreground"
              >
                Insurance Company
              </label>
              <input
                id="insuranceCompany"
                type="text"
                value={formData.insuranceCompany}
                onChange={(e) =>
                  setFormData({ ...formData, insuranceCompany: e.target.value })
                }
                className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="block mb-1 text-sm font-medium text-foreground"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
              />
            </div>
            <div>
              <label
                htmlFor="phone"
                className="block mb-1 text-sm font-medium text-foreground"
              >
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
              />
            </div>
            <div>
              <label
                htmlFor="office"
                className="block mb-1 text-sm font-medium text-foreground"
              >
                Office
              </label>
              <input
                id="office"
                type="text"
                value={formData.office}
                onChange={(e) =>
                  setFormData({ ...formData, office: e.target.value })
                }
                className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
              />
            </div>
            <div>
              <label
                htmlFor="territory"
                className="block mb-1 text-sm font-medium text-foreground"
              >
                Territory / Region
              </label>
              <input
                id="territory"
                type="text"
                value={formData.territory}
                onChange={(e) =>
                  setFormData({ ...formData, territory: e.target.value })
                }
                className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
              />
            </div>
            <div className="md:col-span-2">
              <label
                htmlFor="notes"
                className="block mb-1 text-sm font-medium text-foreground"
              >
                Notes
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
                rows={3}
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) =>
                    setFormData({ ...formData, active: e.target.checked })
                  }
                  className="mr-2"
                />
                <span className="text-sm font-medium text-foreground">
                  Active
                </span>
              </label>
            </div>
          </div>
          <button
            type="submit"
            className="mt-4 px-4 py-2 bg-success text-foreground rounded hover:bg-success"
          >
            {editingId ? "Update Adjuster" : "Create Adjuster"}
          </button>
        </form>
      )}

      <div className="bg-surface rounded shadow overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Insurance Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Territory
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-border">
            {adjusters.map((adjuster) => (
              <tr key={adjuster.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground font-medium">
                  {adjuster.fullName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {adjuster.insuranceCompany || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {adjuster.email || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {adjuster.phone || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {adjuster.territory || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  <span
                    className={`px-2 py-1 rounded text-xs ${adjuster.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                  >
                    {adjuster.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleEdit(adjuster)}
                    className="text-info hover:text-blue-900 mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(adjuster)}
                    className="text-warning hover:text-yellow-900 mr-3"
                  >
                    {adjuster.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => handleDelete(adjuster.id)}
                    className="text-destructive hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {adjusters.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-4 text-center text-sm text-muted-foreground"
                >
                  No adjusters found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2">
            Page {page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
            disabled={page === pagination.totalPages}
            className="px-4 py-2 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
