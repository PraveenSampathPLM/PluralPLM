import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link, useParams } from "react-router-dom";

interface TaskRecord {
  instanceId: string;
  entityType: string;
  entityId: string;
  currentState: string;
  definitionName: string;
  assignedRoles: string[];
  description?: string | null;
}

interface TasksResponse {
  data: TaskRecord[];
}

export function TaskDetailPage(): JSX.Element {
  const params = useParams();
  const taskId = String(params.id ?? "");

  const { data, isLoading } = useQuery({
    queryKey: ["workflow-tasks"],
    queryFn: async () => (await api.get<TasksResponse>("/workflows/tasks")).data
  });

  const task = data?.data.find((row) => row.instanceId === taskId);

  if (isLoading) {
    return <div className="rounded-lg bg-white p-4">Loading task...</div>;
  }

  if (!task) {
    return <div className="rounded-lg bg-white p-4">Task not found.</div>;
  }

  const detailLink =
    task.entityType === "CHANGE_REQUEST"
      ? `/changes/${task.entityId}`
      : task.entityType === "RELEASE_REQUEST"
        ? `/releases/${task.entityId}`
        : task.entityType === "FORMULA"
          ? `/formulas/${task.entityId}`
          : task.entityType === "BOM"
            ? `/bom/${task.entityId}`
            : task.entityType === "ITEM"
              ? `/items/${task.entityId}`
              : "#";

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">Workflow Task</p>
          <h2 className="font-heading text-xl">{task.definitionName}</h2>
          <p className="text-sm text-slate-500">{task.entityType} · {task.currentState}</p>
        </div>
        <Link to="/tasks" className="rounded border border-slate-300 bg-white px-3 py-1 text-sm">
          Back to Tasks
        </Link>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="mb-2 font-medium">Assigned Roles</p>
        <p className="text-slate-700">{task.assignedRoles.join(", ") || "N/A"}</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="mb-2 font-medium">Task Description</p>
        <p className="text-slate-700">{task.description || "No task description configured."}</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="mb-2 font-medium">Routing</p>
        {detailLink === "#" ? (
          <p className="text-slate-500">No object link available.</p>
        ) : (
          <Link to={detailLink} className="rounded border border-slate-300 bg-white px-3 py-1 text-xs">
            Open Object
          </Link>
        )}
      </div>
    </div>
  );
}
