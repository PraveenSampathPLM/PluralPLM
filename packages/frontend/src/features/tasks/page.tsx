import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";

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

export function TasksPage(): JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: ["workflow-tasks"],
    queryFn: async () => (await api.get<TasksResponse>("/workflows/tasks")).data
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div>
        <h2 className="font-heading text-xl">My Workflow Tasks</h2>
        <p className="text-sm text-slate-500">Tasks assigned to you by role assignment.</p>
      </div>
      {isLoading ? (
        <p>Loading tasks...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No tasks assigned.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2">Entity</th>
              <th className="py-2">Workflow</th>
              <th className="py-2">State</th>
              <th className="py-2">Task</th>
              <th className="py-2">Assigned</th>
              <th className="py-2">Open</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((task) => {
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
              const taskLink = `/tasks/${task.instanceId}`;

              return (
                <tr key={task.instanceId} className="border-b border-slate-100">
                  <td className="py-2">{task.entityType}</td>
                  <td className="py-2">{task.definitionName}</td>
                  <td className="py-2">{task.currentState}</td>
                  <td className="py-2 text-xs text-slate-600">{task.description || "No task description"}</td>
                  <td className="py-2 text-xs text-slate-500">
                    Roles: {task.assignedRoles.join(", ") || "N/A"}
                  </td>
                  <td className="py-2">
                    {detailLink === "#" ? (
                      <span className="text-xs text-slate-400">N/A</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Link to={taskLink} className="rounded border border-slate-300 px-2 py-1 text-xs">
                          View Task
                        </Link>
                        <Link to={detailLink} className="rounded border border-slate-300 px-2 py-1 text-xs">
                          Open Object
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
