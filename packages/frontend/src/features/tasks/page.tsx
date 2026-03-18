import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/status-badge";

interface AssignedUser {
  id: string;
  name: string;
}

interface TaskRecord {
  id: string;
  title: string;
  description?: string | null;
  state: string;
  status: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  assignedRoles: string[];
  assignedToUser?: AssignedUser | null;
  dueDate?: string | null;
  isOverdue?: boolean;
  entityType: string;
  entityId: string;
  definitionName: string;
  objectRoute?: string | null;
  createdAt: string;
}

interface TasksResponse {
  data: TaskRecord[];
}

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-orange-50 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700"
};

const ENTITY_LABEL: Record<string, string> = {
  CHANGE_REQUEST: "Change",
  RELEASE_REQUEST: "Release",
  FORMULA: "Formula",
  ITEM: "Item",
  FG: "Finished Good",
  BOM: "Finished Good"
};

type StatusFilter = "OPEN" | "COMPLETED" | "ALL";

function formatDueDate(dueDate: string | null | undefined, isOverdue: boolean | undefined): JSX.Element | null {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <span className={`text-xs ${isOverdue ? "font-semibold text-red-600" : "text-slate-500"}`}>
      {isOverdue ? "Overdue · " : ""}{label}
    </span>
  );
}

export function TasksPage(): JSX.Element {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("OPEN");

  const { data, isLoading } = useQuery({
    queryKey: ["workflow-tasks", statusFilter],
    queryFn: async () =>
      (await api.get<TasksResponse>("/workflows/tasks", { params: { status: statusFilter } })).data
  });

  const rows = data?.data ?? [];
  const overdue = rows.filter((t) => t.isOverdue && t.status === "OPEN").length;

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl">My Workflow Tasks</h2>
          <p className="text-sm text-slate-500">Tasks assigned to you by role or direct assignment.</p>
        </div>
        {overdue > 0 ? (
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
            {overdue} overdue
          </span>
        ) : null}
      </div>

      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 w-fit">
        {(["OPEN", "COMPLETED", "ALL"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {s === "OPEN" ? "Active" : s === "COMPLETED" ? "Completed" : "All"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading tasks...</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          {statusFilter === "OPEN" ? "No active tasks assigned to you right now." : "No tasks found."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">Task</th>
                <th className="px-3 py-2">Workflow · State</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2">Assigned</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((task) => (
                <tr
                  key={task.id}
                  className={`border-b border-slate-100 last:border-0 ${task.isOverdue && task.status === "OPEN" ? "bg-red-50/40" : ""}`}
                >
                  <td className="px-3 py-3">
                    <Link
                      to={`/tasks/${task.id}`}
                      className="font-medium text-slate-800 hover:text-primary hover:underline"
                    >
                      {task.title}
                    </Link>
                    {task.description ? (
                      <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{task.description}</p>
                    ) : null}
                    <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                      {ENTITY_LABEL[task.entityType] ?? task.entityType}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-xs text-slate-500">{task.definitionName}</p>
                    <StatusBadge status={task.state} />
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_COLOR[task.priority] ?? PRIORITY_COLOR.MEDIUM}`}>
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {formatDueDate(task.dueDate, task.isOverdue)}
                    {!task.dueDate ? <span className="text-xs text-slate-400">—</span> : null}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500">
                    {task.assignedToUser ? (
                      <span className="font-medium text-slate-700">{task.assignedToUser.name}</span>
                    ) : task.assignedRoles.length ? (
                      task.assignedRoles.join(", ")
                    ) : (
                      <span className="text-slate-400">Open</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      to={`/tasks/${task.id}`}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:border-primary hover:text-primary"
                    >
                      {task.status === "OPEN" ? "Review" : "View"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
