/**
 * WorkflowVisualizer
 * Visual stepper + pending info + transition history for a WorkflowInstance.
 */

export interface WfTask {
  id: string;
  state: string;
  status: string; // "OPEN" | "CLOSED" | ...
  assignedToUser?: { id: string; name: string; email: string } | null | undefined;
  assignedRoles: string[];
  dueDate?: string | null | undefined;
  comment?: string | null | undefined;
  completedAt?: string | null | undefined;
  completedBy?: { id: string; name: string } | null | undefined;
}

export interface WfDefinition {
  name: string;
  states: string[];
  transitions: Array<{ from: string; to: string; action: string; label?: string | undefined }>;
  actions?: {
    stateAssignments?: Record<
      string,
      { roles?: string[] | undefined; description?: string | undefined; slaHours?: number | undefined }
    >;
  } | null | undefined;
}

export interface WfHistoryEntry {
  from: string;
  to: string;
  action: string;
  actorId?: string | undefined;
  actorName?: string | undefined;
  comment?: string | undefined;
  at: string;
}

export interface WorkflowInstanceFull {
  id: string;
  currentState: string;
  history: WfHistoryEntry[];
  definition?: WfDefinition | null | undefined;
  tasks?: WfTask[] | undefined;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return iso;
  }
}

function slaColor(slaHours: number, enteredAt: string | undefined): string {
  if (!enteredAt) return "text-slate-500";
  const elapsed = (Date.now() - new Date(enteredAt).getTime()) / 3_600_000;
  if (elapsed > slaHours) return "text-red-600 font-semibold";
  if (elapsed > slaHours * 0.75) return "text-amber-600";
  return "text-emerald-600";
}

function stateLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Map a raw state name to a semantic colour class */
function stateColour(
  s: string,
  phase: "past" | "current" | "future"
): { dot: string; line: string } {
  if (phase === "past") return { dot: "bg-emerald-500 border-emerald-500", line: "bg-emerald-300" };
  if (phase === "current") {
    const upper = s.toUpperCase();
    if (upper.includes("REJECT")) return { dot: "bg-red-500 border-red-500", line: "bg-slate-200" };
    if (upper.includes("RELEASE") || upper.includes("IMPLEMENT") || upper.includes("CLOSE"))
      return { dot: "bg-emerald-600 border-emerald-600", line: "bg-slate-200" };
    return { dot: "bg-primary border-primary", line: "bg-slate-200" };
  }
  return { dot: "bg-white border-slate-300", line: "bg-slate-200" };
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  instance: WorkflowInstanceFull | null | undefined;
  loading?: boolean;
  /** Entity status — used when no workflow has started yet */
  entityStatus?: string;
  entityLabel?: string; // e.g. "change" or "release"
}

export function WorkflowVisualizer({ instance, loading, entityStatus, entityLabel }: Props): JSX.Element {
  if (loading) {
    return (
      <div className="animate-pulse space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-5">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="flex items-center gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-slate-200" />
              {i < 3 && <div className="h-1 w-16 rounded bg-slate-200" />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <p className="text-sm font-medium text-slate-500">Workflow not started yet</p>
        <p className="mt-1 text-xs text-slate-400">
          Submit this {entityLabel ?? "record"} to initiate the approval workflow.
        </p>
        {entityStatus && (
          <p className="mt-2 text-xs text-slate-400">
            Current status: <span className="font-medium">{entityStatus}</span>
          </p>
        )}
      </div>
    );
  }

  const def = instance.definition;
  const rawStates: string[] = Array.isArray(def?.states) ? (def?.states as string[]) : [];
  const transitions = Array.isArray(def?.transitions) ? (def?.transitions as Array<{ from: string; to: string; action: string }>) : [];
  const stateAssignments = (def?.actions as { stateAssignments?: Record<string, { roles?: string[]; description?: string; slaHours?: number }> } | null)?.stateAssignments ?? {};
  const history: WfHistoryEntry[] = Array.isArray(instance.history) ? (instance.history as WfHistoryEntry[]) : [];

  const currentState = instance.currentState;
  const currentIdx = rawStates.indexOf(currentState);
  const visitedStates = new Set(history.map((h) => h.from));

  // Active task for the current state
  const activeTasks = (instance.tasks ?? []).filter(
    (t) => t.state === currentState && t.status === "OPEN"
  );
  const activeTask = activeTasks[0];
  const assignment = stateAssignments[currentState];

  // Who is it pending with
  const pendingUser = activeTask?.assignedToUser?.name;
  const pendingRoles = activeTask?.assignedRoles?.length
    ? activeTask.assignedRoles
    : assignment?.roles?.length
    ? assignment.roles
    : [];

  // When did we enter the current state?
  const enteredAt = history.find((h) => h.to === currentState)?.at;

  // Phase of each state
  function phase(state: string, idx: number): "past" | "current" | "future" {
    if (state === currentState) return "current";
    if (visitedStates.has(state)) return "past";
    if (idx < currentIdx) return "past";
    return "future";
  }

  const isTerminal = transitions.filter((t) => t.from === currentState).length === 0;

  return (
    <div className="space-y-5">
      {/* ── Stepper ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">{def?.name ?? "Workflow"}</h4>
          <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
            isTerminal
              ? currentState.toUpperCase().includes("REJECT")
                ? "bg-red-100 text-red-700"
                : "bg-emerald-100 text-emerald-700"
              : "bg-primary/10 text-primary"
          }`}>
            {isTerminal ? (currentState.toUpperCase().includes("REJECT") ? "❌ Rejected" : "✅ Completed") : "⏳ In Progress"}
          </span>
        </div>

        {/* Stepper nodes */}
        <div className="relative flex items-start justify-between gap-0 overflow-x-auto pb-2">
          {rawStates.map((state, idx) => {
            const p = phase(state, idx);
            const colours = stateColour(state, p);
            const isCurrent = p === "current";
            const isPast = p === "past";

            return (
              <div key={state} className="flex min-w-0 flex-1 flex-col items-center">
                {/* Connector left */}
                <div className="flex w-full items-center">
                  {idx > 0 && (
                    <div className={`h-0.5 flex-1 transition-all duration-500 ${
                      isPast || isCurrent ? "bg-emerald-400" : "bg-slate-200"
                    }`} />
                  )}

                  {/* Node circle */}
                  <div className="relative flex flex-shrink-0 flex-col items-center">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-300 ${colours.dot} ${
                        isCurrent ? "shadow-md ring-4 ring-primary/20 ring-offset-1" : ""
                      } ${isPast ? "text-white" : isCurrent ? "text-white" : "text-slate-400"}`}
                    >
                      {isPast ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : isCurrent ? (
                        <svg className="h-4 w-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="5" />
                        </svg>
                      ) : (
                        <span className="text-[10px]">{idx + 1}</span>
                      )}
                    </div>
                  </div>

                  {/* Connector right */}
                  {idx < rawStates.length - 1 && (
                    <div className={`h-0.5 flex-1 transition-all duration-500 ${
                      isPast ? "bg-emerald-400" : "bg-slate-200"
                    }`} />
                  )}
                </div>

                {/* Label below the circle */}
                <div className={`mt-2 text-center text-[10px] leading-tight ${
                  isCurrent ? "font-semibold text-primary" : isPast ? "text-emerald-600" : "text-slate-400"
                }`}>
                  {stateLabel(state)}
                  {isCurrent && !isTerminal && (
                    <div className="mt-0.5 text-[9px] font-normal text-slate-400">← active</div>
                  )}
                  {isPast && (
                    <div className="mt-0.5 text-[9px] font-normal text-emerald-500">✓ done</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Current-state detail card ─────────────────────────────── */}
      {!isTerminal && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-800">{stateLabel(currentState)}</span>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary uppercase tracking-wide">Active</span>
              </div>

              {assignment?.description && (
                <p className="text-xs text-slate-600">{assignment.description}</p>
              )}

              {/* Pending with */}
              <div className="flex flex-wrap gap-3 text-xs">
                {pendingUser ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Pending with:</span>
                    <span className="flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2 py-0.5 font-medium text-slate-700 shadow-sm">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] text-white font-bold">
                        {pendingUser.charAt(0).toUpperCase()}
                      </span>
                      {pendingUser}
                    </span>
                  </div>
                ) : pendingRoles.length > 0 ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500">Pending with:</span>
                    {pendingRoles.map((role) => (
                      <span
                        key={role}
                        className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Pending with:</span>
                    <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                  </div>
                )}

                {/* SLA */}
                {assignment?.slaHours != null && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">SLA:</span>
                    <span className={`font-medium ${slaColor(assignment.slaHours, enteredAt)}`}>
                      {assignment.slaHours}h
                      {enteredAt && (() => {
                        const elapsed = (Date.now() - new Date(enteredAt).getTime()) / 3_600_000;
                        const remaining = assignment.slaHours - elapsed;
                        if (remaining <= 0) return <span className="ml-1 text-red-500">(overdue by {Math.round(-remaining)}h)</span>;
                        return <span className="ml-1 text-emerald-600">({Math.round(remaining)}h remaining)</span>;
                      })()}
                    </span>
                  </div>
                )}
              </div>

              {/* Active task details */}
              {activeTask?.dueDate && (
                <p className="text-xs text-slate-500">
                  Due: <span className="font-medium text-slate-700">{fmtDate(activeTask.dueDate)}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Transition history timeline ───────────────────────────── */}
      {history.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Transition History
          </h4>
          <ol className="relative ml-2 space-y-0 border-l border-slate-200">
            {history.map((entry, i) => (
              <li key={i} className="ml-4 pb-4 last:pb-0">
                {/* Timeline dot */}
                <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400 shadow" />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-slate-700">
                      {stateLabel(entry.from)}
                    </span>
                    <svg className="h-3 w-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span className="text-xs font-semibold text-primary">{stateLabel(entry.to)}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 uppercase">
                      {entry.action}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    {(entry.actorName ?? entry.actorId) && (
                      <span className="font-medium text-slate-500">
                        {entry.actorName ?? entry.actorId}
                      </span>
                    )}
                    <span>·</span>
                    <span>{fmtDate(entry.at)}</span>
                  </div>
                  {entry.comment && (
                    <p className="mt-0.5 rounded bg-slate-50 border border-slate-100 px-2 py-1 text-[11px] text-slate-600 italic">
                      "{entry.comment}"
                    </p>
                  )}
                </div>
              </li>
            ))}
            {/* Current state end dot */}
            <li className="ml-4">
              <div className={`absolute -left-1.5 h-3 w-3 rounded-full border-2 border-white shadow ${
                isTerminal ? "bg-emerald-500" : "bg-primary animate-pulse"
              }`} />
              <div className="text-xs font-medium text-primary">{stateLabel(currentState)}</div>
              <div className="text-[10px] text-slate-400">{isTerminal ? "Completed" : "Currently active"}</div>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
