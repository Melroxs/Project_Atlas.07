"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

interface UsersResponse {
  data: User[];
}

export default function UsersPage() {
  const { session, loading } = useSupabase();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [status, setStatus] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      router.push("/login");
      return;
    }
    loadUsers();
  }, [session, router]);

  const loadUsers = async () => {
    try {
      const data = await apiFetch<UsersResponse>("/users");
      setUsers(data.data || []);
    } catch (e: any) {
      setStatus(`Error loading: ${e.message}`);
    }
  };

  const handleRoleChange = async (id: string, role: string) => {
    setSavingId(id);
    try {
      await apiFetch(`/users/${id}`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
      setStatus("User role updated");
      loadUsers();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this user from the company? This does not delete their account.")) return;
    try {
      await apiFetch(`/users/${id}`, { method: "DELETE" });
      setStatus("User removed");
      loadUsers();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!session) return null;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground">Manage team members and their roles</p>
      </div>

      {status && <p className="mb-4 text-sm text-muted-foreground">{status}</p>}

      <div className="bg-surface rounded shadow overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Joined</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-border">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-muted">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold mr-3">
                      {(user.name || user.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="text-sm font-medium text-foreground">{user.name}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={user.role}
                    disabled={savingId === user.id}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className="p-1 text-xs bg-muted dark:bg-card border border-input rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 transition-colors hover:border-primary"
                    aria-label={`Role for ${user.email}`}
                  >
                    <option value="Owner">Owner</option>
                    <option value="Admin">Admin</option>
                    <option value="Member">Member</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => handleDelete(user.id)} className="text-destructive hover:text-red-900">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-muted-foreground">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
