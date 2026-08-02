"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useRouter } from "next/navigation";

interface Company {
  id: string;
  name: string;
  slug: string;
  plan: string | null;
  created_at: string;
}

export default function CompaniesPage() {
  const { session, loading } = useSupabase();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    plan: "",
  });
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!session) {
      router.push("/login");
      return;
    }
    loadCompanies();
  }, [session, router]);

  const loadCompanies = async () => {
    try {
      const data = await apiFetch<Company[]>("/companies");
      setCompanies(data);
    } catch (e: any) {
      setStatus(`Error loading: ${e.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        slug: formData.slug || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      };
      if (editingId) {
        await apiFetch(`/companies/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setStatus("Company updated");
      } else {
        await apiFetch("/companies", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setStatus("Company created");
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: "", slug: "", plan: "" });
      loadCompanies();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  const handleEdit = (company: Company) => {
    setEditingId(company.id);
    setFormData({
      name: company.name,
      slug: company.slug,
      plan: company.plan || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this company?")) return;
    try {
      await apiFetch(`/companies/${id}`, { method: "DELETE" });
      setStatus("Company deleted");
      loadCompanies();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!session) return null;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">Companies</h1>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: "", slug: "", plan: "" });
            setShowForm(!showForm);
          }}
          className="px-4 py-2 bg-info text-foreground rounded hover:bg-info"
        >
          {showForm ? "Cancel" : "Add Company"}
        </button>
      </div>

      {status && <p className="mb-4 text-sm text-muted-foreground">{status}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 bg-surface p-6 rounded shadow">
          <h3 className="text-lg font-semibold mb-4 text-foreground">
            {editingId ? "Edit Company" : "New Company"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="companyName" className="block mb-1 text-sm font-medium text-foreground">
                Company Name
              </label>
              <input
                id="companyName"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
                required
              />
            </div>
            <div>
              <label htmlFor="companySlug" className="block mb-1 text-sm font-medium text-foreground">
                Slug
              </label>
              <input
                id="companySlug"
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="auto-generated from name"
                className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
              />
            </div>
            <div>
              <label htmlFor="companyPlan" className="block mb-1 text-sm font-medium text-foreground">
                Plan
              </label>
              <select
                id="companyPlan"
                value={formData.plan}
                onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
              >
                <option value="">No plan</option>
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="business">Business</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="mt-4 px-4 py-2 bg-success text-foreground rounded hover:bg-success"
          >
            {editingId ? "Update Company" : "Save Company"}
          </button>
        </form>
      )}

      <div className="bg-surface rounded shadow overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Slug</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Plan</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-border">
            {companies.map((company) => (
              <tr key={company.id} className="hover:bg-muted">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground font-medium">{company.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{company.slug}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{company.plan || "-"}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {new Date(company.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => handleEdit(company)} className="text-info hover:text-blue-900 mr-3">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(company.id)} className="text-destructive hover:text-red-900">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-muted-foreground">
                  No companies found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
