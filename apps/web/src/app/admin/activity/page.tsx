"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useLiveRefresh } from "@/lib/data-events";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useRouter } from "next/navigation";

interface ActivityLog {
  id: string;
  companyId: string;
  userId: string | null;
  userName: string | null;
  entityType: string;
  entityId: string | null;
  entityName: string | null;
  action: string;
  description: string | null;
  previousValues: any;
  newValues: any;
  ipAddress: string | null;
  createdAt: string;
}

interface ActivityResponse {
  data: ActivityLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface FilterOption {
  userId: string | null;
  userName: string | null;
}

interface EntityTypeOption {
  entityType: string;
}

interface ActionOption {
  action: string;
}

// Activity type icons mapping
const getActivityIcon = (action: string, entityType: string) => {
  const actionLower = action.toLowerCase();
  const entityLower = entityType.toLowerCase();

  if (actionLower === "create") return "➕";
  if (actionLower === "update") return "✏️";
  if (actionLower === "delete") return "🗑️";
  if (actionLower === "upload") return "📤";
  if (actionLower === "download") return "📥";
  if (actionLower === "assignment") return "👤";
  if (actionLower === "status_change") return "🔄";
  if (actionLower === "interview") return "💬";
  if (actionLower === "supplement") return "📄";

  // Entity-based fallback icons
  if (entityLower === "document") return "📁";
  if (entityLower === "claim") return "📋";
  if (entityLower === "adjuster") return "👔";
  if (entityLower === "property") return "🏠";
  if (entityLower === "company") return "🏢";
  if (entityLower === "task") return "✅";

  return "📝";
};

const getActivityColor = (action: string) => {
  const actionLower = action.toLowerCase();
  if (actionLower === "create") return "bg-success/10 text-green-800";
  if (actionLower === "update") return "bg-info/10 text-blue-800";
  if (actionLower === "delete") return "bg-destructive/10 text-destructive";
  if (actionLower === "upload") return "bg-accent/10 text-purple-800";
  if (actionLower === "download") return "bg-accent/10 text-indigo-800";
  if (actionLower === "assignment") return "bg-warning/10 text-warning";
  if (actionLower === "status_change") return "bg-warning/10 text-orange-800";
  return "bg-muted text-foreground";
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getEntityLink = (entityType: string, entityId: string | null) => {
  if (!entityId) return null;
  const entityLower = entityType.toLowerCase();
  if (entityLower === "document") return `/admin/documents`;
  if (entityLower === "claim") return `/admin/claims`;
  if (entityLower === "adjuster") return `/admin/adjusters`;
  if (entityLower === "property") return `/admin/properties`;
  if (entityLower === "company") return `/admin/companies`;
  if (entityLower === "task") return `/admin/tasks`;
  return null;
};

export default function ActivityPage() {
  const { session, loading } = useSupabase();
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<FilterOption[]>([]);
  const [entityTypes, setEntityTypes] = useState<EntityTypeOption[]>([]);
  const [actions, setActions] = useState<ActionOption[]>([]);
  const [status, setStatus] = useState("");

  // Filter state
  const [userId, setUserId] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    if (!session) {
      router.push("/login");
      return;
    }
    loadActivities();
    loadFilters();
  }, [
    session,
    router,
    userId,
    entityType,
    action,
    search,
    startDate,
    endDate,
    page,
  ]);

  useLiveRefresh(() => loadActivities());

  const loadActivities = async () => {
    try {
      const params = new URLSearchParams();
      if (userId) params.append("userId", userId);
      if (entityType) params.append("entityType", entityType);
      if (action) params.append("action", action);
      if (search) params.append("search", search);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("page", page.toString());
      params.append("limit", "50");

      const data = await apiFetch<ActivityResponse>(
        `/activity?${params.toString()}`,
      );
      setActivities(data.data);
      setPagination(data.pagination);
    } catch (e: any) {
      setStatus(`Error loading: ${e.message}`);
    }
  };

  const loadFilters = async () => {
    try {
      const [usersData, entityTypesData, actionsData] = await Promise.all([
        apiFetch<FilterOption[]>("/activity/users"),
        apiFetch<EntityTypeOption[]>("/activity/entity-types"),
        apiFetch<ActionOption[]>("/activity/actions"),
      ]);
      setUsers(usersData);
      setEntityTypes(entityTypesData);
      setActions(actionsData);
    } catch (e: any) {
      console.error("Error loading filters:", e);
    }
  };

  const clearFilters = () => {
    setUserId("");
    setEntityType("");
    setAction("");
    setSearch("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  if (loading) return <p>Loading...</p>;
  if (!session) return null;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Activity Timeline
        </h1>
      </div>

      {status && <p className="mb-4 text-sm text-muted-foreground">{status}</p>}

      {/* Filters */}
      <div className="mb-6 bg-surface p-4 rounded shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
          <div>
            <label
              htmlFor="user"
              className="block mb-1 text-sm font-medium text-foreground"
            >
              User
            </label>
            <select
              id="user"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
            >
              <option value="">All Users</option>
              {users.map((user) => (
                <option
                  key={user.userId || "unknown"}
                  value={user.userId || ""}
                >
                  {user.userName || "Unknown"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="entityType"
              className="block mb-1 text-sm font-medium text-foreground"
            >
              Entity Type
            </label>
            <select
              id="entityType"
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
            >
              <option value="">All Types</option>
              {entityTypes.map((type) => (
                <option key={type.entityType} value={type.entityType}>
                  {type.entityType}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="action"
              className="block mb-1 text-sm font-medium text-foreground"
            >
              Action
            </label>
            <select
              id="action"
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
            >
              <option value="">All Actions</option>
              {actions.map((act) => (
                <option key={act.action} value={act.action}>
                  {act.action}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="startDate"
              className="block mb-1 text-sm font-medium text-foreground"
            >
              Start Date
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
            />
          </div>
          <div>
            <label
              htmlFor="endDate"
              className="block mb-1 text-sm font-medium text-foreground"
            >
              End Date
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
            />
          </div>
          <div>
            <label
              htmlFor="search"
              className="block mb-1 text-sm font-medium text-foreground"
            >
              Search
            </label>
            <input
              id="search"
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 bg-muted dark:bg-card border-input rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-primary"
            />
          </div>
        </div>
        <button
          onClick={clearFilters}
          className="px-4 py-2 bg-muted text-foreground rounded hover:bg-accent"
        >
          Clear Filters
        </button>
      </div>

      {/* Activity Timeline */}
      <div className="bg-surface rounded shadow p-6">
        {activities.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No activity found
          </p>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => {
              const icon = getActivityIcon(
                activity.action,
                activity.entityType,
              );
              const colorClass = getActivityColor(activity.action);
              const entityLink = getEntityLink(
                activity.entityType,
                activity.entityId,
              );

              return (
                <div
                  key={activity.id}
                  className="flex items-start space-x-4 p-4 border rounded hover:bg-muted"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xl">
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${colorClass}`}
                      >
                        {activity.action}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {activity.entityType}
                      </span>
                      {entityLink && (
                        <a
                          href={entityLink}
                          className="text-sm text-info hover:text-blue-800"
                        >
                          View
                        </a>
                      )}
                    </div>
                    <p className="text-sm text-foreground mb-1">
                      {activity.description ||
                        `${activity.action} ${activity.entityType}`}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      <span>{activity.userName || "Unknown user"}</span>
                      <span>•</span>
                      <span>{formatTimestamp(activity.createdAt)}</span>
                      {activity.ipAddress && (
                        <>
                          <span>•</span>
                          <span>{activity.ipAddress}</span>
                        </>
                      )}
                    </div>
                    {activity.entityName && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Entity: {activity.entityName}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
            Page {page} of {pagination.totalPages} ({pagination.total} total)
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
