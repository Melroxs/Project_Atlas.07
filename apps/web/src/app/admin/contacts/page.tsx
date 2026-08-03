"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useLiveRefresh } from "@/lib/data-events";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useRouter } from "next/navigation";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  createdAt: string;
}

export default function ContactsPage() {
  const { session, loading } = useSupabase();
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
  });
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!session) {
      router.push("/login");
      return;
    }
    loadContacts();
  }, [session, router]);

  useLiveRefresh(() => loadContacts());

  const loadContacts = async () => {
    try {
      const data = await apiFetch<Contact[]>("/contacts");
      setContacts(data);
    } catch (e: any) {
      setStatus(`Error loading: ${e.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiFetch(`/contacts/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(formData),
        });
        setStatus("Contact updated");
      } else {
        await apiFetch("/contacts", {
          method: "POST",
          body: JSON.stringify(formData),
        });
        setStatus("Contact created");
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: "", email: "", phone: "", role: "" });
      loadContacts();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingId(contact.id);
    setFormData({
      name: contact.name,
      email: contact.email || "",
      phone: contact.phone || "",
      role: contact.role || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;
    try {
      await apiFetch(`/contacts/${id}`, { method: "DELETE" });
      setStatus("Contact deleted");
      loadContacts();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!session) return null;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: "", email: "", phone: "", role: "" });
            setShowForm(!showForm);
          }}
          className="px-4 py-2 bg-info text-foreground rounded hover:bg-info"
        >
          {showForm ? "Cancel" : "Add Contact"}
        </button>
      </div>

      {status && <p className="mb-4 text-sm text-muted-foreground">{status}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 bg-surface p-6 rounded shadow">
          <h3 className="text-lg font-semibold mb-4 text-foreground">
            {editingId ? "Edit Contact" : "New Contact"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="contactName" className="block mb-1 text-sm font-medium text-foreground">
                Name
              </label>
              <input
                id="contactName"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
                required
              />
            </div>
            <div>
              <label htmlFor="contactRole" className="block mb-1 text-sm font-medium text-foreground">
                Role
              </label>
              <input
                id="contactRole"
                type="text"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                placeholder="e.g. Property Manager"
                className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
              />
            </div>
            <div>
              <label htmlFor="contactEmail" className="block mb-1 text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="contactEmail"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
              />
            </div>
            <div>
              <label htmlFor="contactPhone" className="block mb-1 text-sm font-medium text-foreground">
                Phone
              </label>
              <input
                id="contactPhone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
              />
            </div>
          </div>
          <button
            type="submit"
            className="mt-4 px-4 py-2 bg-success text-foreground rounded hover:bg-success"
          >
            {editingId ? "Update Contact" : "Save Contact"}
          </button>
        </form>
      )}

      <div className="bg-surface rounded shadow overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-border">
            {contacts.map((contact) => (
              <tr key={contact.id} className="hover:bg-muted">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground font-medium">{contact.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{contact.role || "-"}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{contact.email || "-"}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{contact.phone || "-"}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {new Date(contact.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => handleEdit(contact)} className="text-info hover:text-blue-900 mr-3">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(contact.id)} className="text-destructive hover:text-red-900">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-muted-foreground">
                  No contacts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
