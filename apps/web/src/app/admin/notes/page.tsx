"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useRouter } from "next/navigation";

interface Note {
  id: string;
  entityType: string | null;
  entityId: string | null;
  content: string;
  createdAt: string;
}

export default function NotesPage() {
  const { session, loading } = useSupabase();
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ content: "" });
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!session) {
      router.push("/login");
      return;
    }
    loadNotes();
  }, [session, router]);

  const loadNotes = async () => {
    try {
      const data = await apiFetch<Note[]>("/notes");
      setNotes(data);
    } catch (e: any) {
      setStatus(`Error loading: ${e.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content.trim()) {
      setStatus("Note content is required");
      return;
    }
    try {
      if (editingId) {
        await apiFetch(`/notes/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({ content: formData.content }),
        });
        setStatus("Note updated");
      } else {
        await apiFetch("/notes", {
          method: "POST",
          body: JSON.stringify({ content: formData.content }),
        });
        setStatus("Note created");
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ content: "" });
      loadNotes();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  const handleEdit = (note: Note) => {
    setEditingId(note.id);
    setFormData({ content: note.content });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;
    try {
      await apiFetch(`/notes/${id}`, { method: "DELETE" });
      setStatus("Note deleted");
      loadNotes();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!session) return null;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">Notes</h1>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ content: "" });
            setShowForm(!showForm);
          }}
          className="px-4 py-2 bg-info text-foreground rounded hover:bg-info"
        >
          {showForm ? "Cancel" : "Add Note"}
        </button>
      </div>

      {status && <p className="mb-4 text-sm text-muted-foreground">{status}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 bg-surface p-6 rounded shadow">
          <h3 className="text-lg font-semibold mb-4 text-foreground">
            {editingId ? "Edit Note" : "New Note"}
          </h3>
          <div>
            <label htmlFor="noteContent" className="block mb-1 text-sm font-medium text-foreground">
              Note
            </label>
            <textarea
              id="noteContent"
              value={formData.content}
              onChange={(e) => setFormData({ content: e.target.value })}
              rows={4}
              className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
              placeholder="Write a note..."
              required
            />
          </div>
          <button
            type="submit"
            className="mt-4 px-4 py-2 bg-success text-foreground rounded hover:bg-success"
          >
            {editingId ? "Update Note" : "Save Note"}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {notes.map((note) => (
          <div key={note.id} className="bg-surface rounded-lg border p-4 hover:shadow-md transition-shadow">
            <p className="text-sm text-foreground mb-4 whitespace-pre-wrap line-clamp-4">{note.content}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {new Date(note.createdAt).toLocaleDateString()}
              </span>
              <div className="flex space-x-2">
                <button onClick={() => handleEdit(note)} className="text-info hover:text-blue-900 text-sm">
                  Edit
                </button>
                <button onClick={() => handleDelete(note.id)} className="text-destructive hover:text-red-900 text-sm">
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {notes.length === 0 && (
          <div className="col-span-full text-center py-12 bg-surface rounded-lg border">
            <p className="text-muted-foreground">No notes found</p>
          </div>
        )}
      </div>
    </div>
  );
}
