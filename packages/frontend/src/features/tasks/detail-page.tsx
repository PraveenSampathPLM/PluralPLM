import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link, useParams } from "react-router-dom";
import { DetailHeaderCard } from "@/components/detail-header-card";
import { StatusBadge } from "@/components/status-badge";
import { AffectedObjects } from "@/components/affected-objects";
import { toast } from "sonner";

interface RoutingOption {
  action: string;
  toState: string;
  label: string;
  style: string;
}

interface HistoryEntry {
  from: string;
  to: string;
  action: string;
  actorId: string;
  comment?: string;
  at: string;
}

interface TaskDetail {
  id: string;
  workflowInstanceId: string;
  title: string;
  description?: string | null;
  state: string;
  status: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  assignedRoles: string[];
  assignedToUser?: { id: string; name: string; email: string } | null;
  completedBy?: { id: string; name: string } | null;
  dueDate?: string | null;
  isOverdue?: boolean;
  comment?: string | null;
  completedAt?: string | null;
  entityType: string;
  entityId: string;
  routingOptions?: RoutingOption[];
  objectRoute?: string | null;
  workflowHistory?: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
  workflowInstance: {
    id: string;
    currentState: string;
    definition: { name: string };
  };
}

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-orange-50 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700"
};

const ENTITY_LABEL: Record<string, string> = {
  CHANGE_REQUEST: "Change Request",
  RELEASE_REQUEST: "Release Request",
  FORMULA: "Formula",
  ITEM: "Item",
  FG: "Finished Good",
  BOM: "Finished Good"
};

const ACTION_BUTTON_STYLE: Record<string, string> = {
  success: "border-green-600 bg-green-600 text-white hover:bg-green-700",
  danger: "border-red-600 bg-red-600 text-white hover:bg-red-700",
  warning: "border-orange-500 bg-orange-500 text-white hover:bg-orange-600",
  default: "border-primary bg-primary text-white hover:opacity-90"
};

export function TaskDetailPage(): JSX.Element {
  const queryClient = useQueryClient();
  const params = useParams();
  const taskId = String(params.id ?? "");
  const [comment, setComment] = useState("");
  const [activeAction, setActiveAction] = useState<RoutingOption | null>(null);

  const { data: task, isLoading } = useQuery({
    queryKey: ["task-detail", taskId],
    queryFn: async () => (await api.get<TaskDetail>(`/workflows/tasks/${taskId}`)).data,
    enabled: Boolean(taskId)
  });

  const routeTask = useMutation({
    mutationFn: async (payload: { action: string; toState: string; comment: string }) => {
      await api.post(`/workflows/tasks/${taskId}/route`, {
        action: payload.action,
        toState: payload.toState,
        comment: payload.comment || undefined
      });
    },
    onSuccess: async () => {
      toast.success("Task routed successfully.");
      setActiveAction(null);
      setComment("");
      await queryClient.invalidateQueries({ queryKey: ["task-detail", taskId] });
      await queryClient.invalidateQueries({ queryKey: ["workflow-tasks"] });
    },
    onError: (error) => { toast.error((error as Error)?.message ?? "Action failed."); }
  });

  if (isLoading) {
    return <div className="rounded-lg bg-white p-4 text-sm text-slate-500">Loading task...</div>;
  }

  if (!task) {
    return <div className="rounded-lg bg-white p-4 text-sm text-slate-500">Task not found.</div>;
  }

  const detailLink = task.objectRoute ?? "#";
  const definitionName = task.workflowInstance?.definition?.name ?? "Workflow";
  const isOpen = task.status === "OPEN";
  const routingOptions = task.routingOptions ?? [];

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <DetailHeaderCard
        code={`Task · ${task.priority}`}
        title={task.title}
        meta={
          <span className="inline-flex items-center gap-2 text-sm text-slate-600">
            <StatusBadge status={task.state} />
            {task.isOverdue ? (
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Overdue</span>
            ) : null}
          </span>
        }
        backTo="/tasks"
        backLabel="Back to Tasks"
        actions={
          detailLink !== "#" ? (
            <Link
              to={detailLink}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-sm hover:border-primary hover:text-primary"
            >
              Open {ENTITY_LABEL[task.entityType] ?? task.entityType}
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="mb-1 text-xs font-medium text-slate-500">Workflow</p>
          <p className="font-medium">{definitionName}</p>
          <p className="text-xs text-slate-500">State: {task.workflowInstance?.currentState ?? task.state}</p>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="mb-1 text-xs font-medium text-slate-500">Priority</p>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_COLOR[task.priority]}`}>
            {task.priority}
          </span>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="mb-1 text-xs font-medium text-slate-500">Due Date</p>
          {task.dueDate ? (
            <p className={task.isOverdue ? "font-semibold text-red-600" : "text-slate-700"}>
              {new Date(task.dueDate).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </p>
          ) : (
            <p className="text-slate-400">No SLA set</p>
          )}
        </div>
      </div>

      {task.description ? (
        <div className="rounded border border-blue-200 bg-blue-50 p-4 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-600">Task Instructions</p>
          <p className="text-slate-800">{task.description}</p>
        </div>
      ) : null}

      <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
        <p className="mb-2 font-medium text-slate-700">Assignment</p>
        {task.assignedToUser ? (
          <p>Assigned to: <span className="font-medium">{task.assignedToUser.name}</span> ({task.assignedToUser.email})</p>
        ) : null}
        {task.assignedRoles.length > 0 ? (
          <p className="text-slate-600">Assigned roles: {task.assignedRoles.join(", ")}</p>
        ) : null}
        {!task.assignedToUser && !task.assignedRoles.length ? (
          <p className="text-slate-400">Open — any member of this container can action</p>
        ) : null}
      </div>

      {(task.entityType === "CHANGE_REQUEST" || task.entityType === "RELEASE_REQUEST") ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-3">
          <p className="mb-3 text-sm font-medium text-slate-700">
            Affected Objects
            <span className="ml-2 text-xs font-normal text-slate-500">
              — {task.entityType === "CHANGE_REQUEST" ? "items and formulas undergoing this change" : "items and formulas in this release"}
            </span>
          </p>
          <AffectedObjects
            entityId={task.entityId}
            entityType={task.entityType as "CHANGE_REQUEST" | "RELEASE_REQUEST"}
            canEdit={false}
          />
        </div>
      ) : null}

      {isOpen ? (
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="mb-3 font-medium text-slate-800">Take Action</p>
          {routingOptions.length === 0 ? (
            <p className="text-sm text-slate-400">No transitions available from the current state.</p>
          ) : !activeAction ? (
            <div className="flex flex-wrap gap-3">
              {routingOptions.map((option) => (
                <button
                  key={`${option.action}-${option.toState}`}
                  type="button"
                  onClick={() => { setActiveAction(option); setComment(""); }}
                  className={`rounded border px-4 py-2 text-sm font-medium transition-opacity ${ACTION_BUTTON_STYLE[option.style] ?? ACTION_BUTTON_STYLE.default}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className={`inline-flex items-center rounded px-3 py-1 text-sm font-medium ${ACTION_BUTTON_STYLE[activeAction.style] ?? ACTION_BUTTON_STYLE.default}`}>
                {activeAction.label}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Signoff Comment <span className="text-red-500">*</span>
                </label>
                <textarea
                  className={`w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${!comment.trim() && routeTask.isError ? "border-red-400" : "border-slate-300"}`}
                  rows={3}
                  placeholder="Required — enter your signoff comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                {!comment.trim() ? (
                  <p className="mt-0.5 text-xs text-slate-400">A comment is required to proceed.</p>
                ) : null}
              </div>
              {routeTask.isError ? (
                <p className="text-xs text-red-600">
                  {(routeTask.error as Error)?.message ?? "Action failed. Try again."}
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveAction(null)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={routeTask.isPending || !comment.trim()}
                  onClick={() =>
                    routeTask.mutate({ action: activeAction.action, toState: activeAction.toState, comment })
                  }
                  className={`rounded border px-4 py-1.5 text-sm font-medium disabled:opacity-60 ${ACTION_BUTTON_STYLE[activeAction.style] ?? ACTION_BUTTON_STYLE.default}`}
                >
                  {routeTask.isPending ? "Submitting..." : `Confirm: ${activeAction.label}`}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm">
          <p className="font-medium text-green-700">Task {task.status.toLowerCase()}</p>
          {task.completedBy ? <p className="text-xs text-green-600">By: {task.completedBy.name}</p> : null}
          {task.completedAt ? (
            <p className="text-xs text-green-600">
              At: {new Date(task.completedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </p>
          ) : null}
          {task.comment ? <p className="mt-1 text-xs text-slate-600">Comment: "{task.comment}"</p> : null}
        </div>
      )}

      {(task.workflowHistory ?? []).length > 0 ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="mb-3 font-medium">Transition History</p>
          <div className="space-y-2">
            {(task.workflowHistory ?? []).map((entry, idx) => (
              <div key={idx} className="flex items-start gap-3 border-b border-slate-100 pb-2 text-xs text-slate-600 last:border-0">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div>
                  <span className="font-medium text-slate-800">{entry.action}</span>
                  <span className="mx-1 text-slate-400">·</span>
                  <span>{entry.from} → {entry.to}</span>
                  <span className="mx-1 text-slate-400">·</span>
                  <span className="text-slate-400">{new Date(entry.at).toLocaleString()}</span>
                  {entry.comment ? (
                    <p className="mt-0.5 italic text-slate-500">"{entry.comment}"</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
