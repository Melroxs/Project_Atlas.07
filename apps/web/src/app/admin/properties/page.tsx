"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useRouter } from "next/navigation";

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  ownerName: string;
}

export default function PropertiesPage() {
  const { session, loading } = useSupabase();
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    address: "",
    city: "",
    state: "",
    zip: "",
    ownerName: "",
  });
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!session) {
      router.push("/login");
      return;
    }
    loadProperties();
  }, [session, router]);

  const loadProperties = async () => {
    try {
      const data = await apiFetch<Property[]>("/properties");
      setProperties(data);
    } catch (e: any) {
      setStatus(`Error loading: ${e.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiFetch<Property>(`/properties/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(formData),
        });
        setStatus("Property updated");
      } else {
        await apiFetch<Property>("/properties", {
          method: "POST",
          body: JSON.stringify(formData),
        });
        setStatus("Property created");
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ address: "", city: "", state: "", zip: "", ownerName: "" });
      loadProperties();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  const handleEdit = (property: Property) => {
    setEditingId(property.id);
    setFormData({
      address: property.address,
      city: property.city,
      state: property.state,
      zip: property.zip,
      ownerName: property.ownerName || "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this property?")) return;
    try {
      await apiFetch(`/properties/${id}`, { method: "DELETE" });
      setStatus("Property deleted");
      loadProperties();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!session) return null;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">Properties</h1>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormData({ address: "", city: "", state: "", zip: "", ownerName: "" });
          }}
          className="px-4 py-2 bg-info text-foreground rounded hover:bg-info/90 transition-colors"
        >
          {showForm ? "Cancel" : "Add Property"}
        </button>
      </div>

      {status && <p className="mb-4 text-sm text-muted-foreground">{status}</p>}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 bg-surface p-6 rounded shadow"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="address"
                className="block mb-1 text-sm font-medium text-foreground"
              >
                Address
              </label>
              <input
                id="address"
                type="text"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                className="w-full p-2 bg-muted dark:bg-card border border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
                required
              />
            </div>
            <div>
              <label
                htmlFor="city"
                className="block mb-1 text-sm font-medium text-foreground"
              >
                City
              </label>
              <input
                id="city"
                type="text"
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                className="w-full p-2 bg-muted dark:bg-card border border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
                required
              />
            </div>
            <div>
              <label
                htmlFor="state"
                className="block mb-1 text-sm font-medium text-foreground"
              >
                State
              </label>
              <input
                id="state"
                type="text"
                value={formData.state}
                onChange={(e) =>
                  setFormData({ ...formData, state: e.target.value })
                }
                className="w-full p-2 bg-muted dark:bg-card border border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
                required
              />
            </div>
            <div>
              <label
                htmlFor="zip"
                className="block mb-1 text-sm font-medium text-foreground"
              >
                ZIP
              </label>
              <input
                id="zip"
                type="text"
                value={formData.zip}
                onChange={(e) =>
                  setFormData({ ...formData, zip: e.target.value })
                }
                className="w-full p-2 bg-muted dark:bg-card border border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label
                htmlFor="ownerName"
                className="block mb-1 text-sm font-medium text-foreground"
              >
                Owner Name
              </label>
              <input
                id="ownerName"
                type="text"
                value={formData.ownerName}
                onChange={(e) =>
                  setFormData({ ...formData, ownerName: e.target.value })
                }
                className="w-full p-2 bg-muted dark:bg-card border border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            className="mt-4 px-4 py-2 bg-success text-foreground rounded hover:bg-success/90 transition-colors"
          >
            {editingId ? "Update Property" : "Save Property"}
          </button>
        </form>
      )}

      <div className="bg-surface rounded shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Address
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                City
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                State
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                ZIP
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Owner
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-gray-200">
            {properties.map((property) => (
              <tr key={property.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {property.address}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {property.city}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {property.state}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {property.zip}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {property.ownerName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleEdit(property)}
                    className="text-info hover:text-blue-800 mr-3 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(property.id)}
                    className="text-destructive hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {properties.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-4 text-center text-sm text-muted-foreground"
                >
                  No properties found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
