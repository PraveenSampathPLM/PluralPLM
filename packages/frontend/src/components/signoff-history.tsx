import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface SignoffTask {
  id: string;
  title: string;
  state: string;
  status: string;
  priority: string;
  assignedRoles: string[];
  assignedToUser?: { id: string; name: string } | null;
  completedAt?: string | null;
  completedBy?: { id: string; name: string } | null;
  comment?: string | null;
  createdAt: string;
  definitionName: string;
}

interface TasksResponse {
  data: SignoffTask[];
}

const STATUS_COLOR: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-green-50 text-green-700",
  CANCELLED: "bg-slate-100 text-slate-500"
};

interface SignoffHistoryProps {
  entityId: string;
  entityType: string;
}

export function SignoffHistory({ entityId, entityType }: SignoffHistoryProps): JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: ["signoff-history", entityId, entityType],
    queryFn: async () =>
      (await api.get<TasksResponse>("/workflows/tasks", { params: { entityId, entityType, status: "ALL" } })).data,
    enabled: Boolean(entityId)
  });

  const tasks = data?.data ?? [];

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading signoff history...</p>;
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        No workflow tasks have been created for this record yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task, idx) => (
        <div key={task.id} className="rounded border border-slate-200 bg-white p-4 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800">{task.title}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLOR[task.status] ?? "bg-slate-100 text-slate-600"}`}>
                  {task.status}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{task.definitionName} · Step {idx + 1}</p>
            </div>
            <span className="shrink-0 text-xs text-slate-400">
              {new Date(task.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>

          <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
            <div>
              <p className="font-medium text-slate-500 uppercase tracking-wide text-[10px] mb-0.5">Assigned To</p>
              {task.assignedToUser ? (
                <p className="font-medium text-slate-700">{task.assignedToUser.name}</p>
              ) : task.assignedRoles.length ? (
                <p>{task.assignedRoles.join(", ")}</p>
              ) : (
                <p className="text-slate-400">Open</p>
              )}
            </div>
            <div>
              <p className="font-medium text-slate-500 uppercase tracking-wide text-[10px] mb-0.5">Actioned By</p>
              {task.completedBy ? (
                <p className="font-medium text-slate-700">{task.completedBy.name}</p>
              ) : (
                <p className="text-slate-400">{task.status === "OPEN" ? "Pending" : "—"}</p>
              )}
            </div>
            <div>
              <p className="font-medium text-slate-500 uppercase tracking-wide text-[10px] mb-0.5">Actioned At</p>
              {task.completedAt ? (
                <p>{new Date(task.completedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>
              ) : (
                <p className="text-slate-400">{task.status === "OPEN" ? "Pending" : "—"}</p>
              )}
            </div>
          </div>

          {task.comment ? (
            <div className="mt-3 rounded bg-slate-50 border border-slate-200 px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 mb-0.5">Signoff Comment</p>
              <p className="text-slate-700 italic">"{task.comment}"</p>
            </div>
          ) : task.status !== "OPEN" ? (
            <p className="mt-2 text-xs text-slate-400 italic">No comment recorded.</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
