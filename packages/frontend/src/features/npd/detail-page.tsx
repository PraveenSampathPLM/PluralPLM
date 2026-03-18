import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { GateReviewModal } from "@/features/npd/gate-review-modal";

type NpdStage = "DISCOVERY" | "FEASIBILITY" | "DEVELOPMENT" | "VALIDATION" | "LAUNCH";
type NpdStatus = "ACTIVE" | "ON_HOLD" | "KILLED" | "COMPLETED";
type TabKey = "overview" | "checklist" | "gatereviews" | "linked" | "timeline";

const STAGES: Array<{ key: NpdStage; label: string; color: string; dotColor: string }> = [
  { key: "DISCOVERY", label: "Discovery", color: "bg-slate-100 text-slate-700 border-slate-300", dotColor: "bg-slate-400" },
  { key: "FEASIBILITY", label: "Feasibility", color: "bg-blue-50 text-blue-700 border-blue-300", dotColor: "bg-blue-500" },
  { key: "DEVELOPMENT", label: "Development", color: "bg-amber-50 text-amber-700 border-amber-300", dotColor: "bg-amber-500" },
  { key: "VALIDATION", label: "Validation", color: "bg-purple-50 text-purple-700 border-purple-300", dotColor: "bg-purple-500" },
  { key: "LAUNCH", label: "Launch", color: "bg-green-50 text-green-700 border-green-300", dotColor: "bg-green-500" }
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  ON_HOLD: "bg-amber-100 text-amber-700",
  KILLED: "bg-red-100 text-red-700",
  COMPLETED: "bg-blue-100 text-blue-700"
};

const DECISION_COLORS: Record<string, string> = {
  GO: "bg-emerald-100 text-emerald-700",
  KILL: "bg-red-100 text-red-700",
  HOLD: "bg-amber-100 text-amber-700",
  RECYCLE: "bg-orange-100 text-orange-700"
};

const TYPE_COLORS: Record<string, string> = {
  FORMULA: "bg-blue-100 text-blue-700",
  DOCUMENT: "bg-slate-100 text-slate-700",
  SPEC: "bg-purple-100 text-purple-700",
  ITEM: "bg-amber-100 text-amber-700",
  ARTWORK: "bg-pink-100 text-pink-700",
  MANUAL: "bg-slate-50 text-slate-500 border border-slate-200"
};

interface GateReview {
  id: string;
  gate: NpdStage;
  decision?: string | undefined;
  mustMeetCriteria: Array<{ id: string; criterion: string; passed: boolean | null }>;
  shouldMeetCriteria: Array<{ id: string; criterion: string; score: number | null; weight: number }>;
  overallScore?: number | undefined;
  comments?: string | undefined;
  reviewedBy?: { id: string; name: string } | null | undefined;
  reviewedAt?: string | null | undefined;
  createdAt: string;
}

interface NpdProject {
  id: string;
  projectCode: string;
  name: string;
  description?: string | undefined;
  stage: NpdStage;
  status: NpdStatus;
  targetLaunchDate?: string | undefined;
  actualLaunchDate?: string | undefined;
  projectLead?: { id: string; name: string; email: string } | null | undefined;
  container?: { id: string; code: string; name: string } | null | undefined;
  fgItem?: { id: string; itemCode: string; name: string; status: string } | null | undefined;
  formula?: { id: string; formulaCode: string; name: string; status: string } | null | undefined;
  gateReviews: GateReview[];
  linkedItemIds: string[];
  linkedFormulaIds: string[];
  linkedDocumentIds: string[];
  linkedSpecIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface Deliverable {
  id: string;
  label: string;
  type: string;
  required: boolean;
  satisfied: boolean;
}

interface DeliverableStatus {
  deliverables: Deliverable[];
  completeness: number;
  stage: string;
}

function StageStepper({ current }: { current: NpdStage }): JSX.Element {
  const currentIdx = STAGES.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center">
      {STAGES.map((stage, idx) => {
        const isPast = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={stage.key} className="flex flex-1 items-center">
            <div className="relative flex flex-col items-center">
              {isCurrent && (
                <span className="absolute inline-flex h-8 w-8 animate-ping rounded-full bg-primary/30" />
              )}
              <div
                className={`relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold
                  ${isPast ? "bg-emerald-500 text-white" : isCurrent ? "bg-primary text-white" : "border-2 border-slate-300 bg-white text-slate-400"}`}
              >
                {isPast ? "✓" : idx + 1}
              </div>
              <span className={`mt-1 text-center text-[10px] font-medium ${isCurrent ? "text-primary" : isPast ? "text-emerald-600" : "text-slate-400"}`}>
                {stage.label}
              </span>
            </div>
            {idx < STAGES.length - 1 && (
              <div className={`h-0.5 flex-1 ${idx < currentIdx ? "bg-emerald-400" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function NpdDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [selectedGate, setSelectedGate] = useState<NpdStage | null>(null);
  const [gateReviewOpen, setGateReviewOpen] = useState(false);
  const [gateReviewGate, setGateReviewGate] = useState<NpdStage>("DISCOVERY");

  const navigate = useNavigate();

  // Edit panel state (basic info only — FG Item & Formula are stage deliverables, created from the checklist)
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", targetLaunchDate: "", projectLeadId: "" });

  const project = useQuery({
    queryKey: ["npd-project", id],
    queryFn: async () => (await api.get<NpdProject>(`/npd/projects/${id ?? ""}`)).data,
    enabled: !!id
  });

  const deliverables = useQuery({
    queryKey: ["npd-deliverables", id],
    queryFn: async () => (await api.get<DeliverableStatus>(`/npd/projects/${id ?? ""}/deliverable-status`)).data,
    enabled: !!id && activeTab === "checklist"
  });

  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (await api.patch<NpdProject>(`/npd/projects/${id ?? ""}`, body)).data,
    onSuccess: () => {
      toast.success("Project updated");
      void queryClient.invalidateQueries({ queryKey: ["npd-project", id] });
    },
    onError: () => toast.error("Failed to update project")
  });

  const editMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (await api.patch<NpdProject>(`/npd/projects/${id ?? ""}`, body)).data,
    onSuccess: () => {
      toast.success("Project saved");
      void queryClient.invalidateQueries({ queryKey: ["npd-project", id] });
      void queryClient.invalidateQueries({ queryKey: ["npd-projects"] });
      setEditOpen(false);
    },
    onError: () => toast.error("Failed to save project")
  });

  const p = project.data;

  if (project.isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-64 rounded bg-slate-200" />
        <div className="h-4 w-96 rounded bg-slate-200" />
        <div className="h-32 rounded-xl bg-slate-200" />
      </div>
    );
  }

  if (!p) {
    return <div className="py-12 text-center text-slate-500">NPD project not found.</div>;
  }

  const currentStageObj = STAGES.find((s) => s.key === p.stage);

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "checklist", label: "Stage Checklist" },
    { key: "gatereviews", label: "Gate Reviews" },
    { key: "linked", label: "Linked Entities" },
    { key: "timeline", label: "Timeline" }
  ];

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link to="/npd" className="flex items-center gap-1 text-sm text-slate-500 hover:text-primary">
        ← NPD Projects
      </Link>

      {/* Header card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-sm font-bold text-slate-700">{p.projectCode}</span>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${currentStageObj?.color ?? ""}`}>
              {currentStageObj?.label ?? p.stage}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[p.status] ?? "bg-slate-100 text-slate-600"}`}>
              {p.status.replace("_", " ")}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditForm({
                  name: p.name,
                  description: p.description ?? "",
                  targetLaunchDate: p.targetLaunchDate ? p.targetLaunchDate.split("T")[0] ?? "" : "",
                  projectLeadId: p.projectLead?.id ?? ""
                });
                setEditOpen(true);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              ✎ Edit Project
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("Put this project ON HOLD?")) updateMutation.mutate({ status: "ON_HOLD" });
              }}
              disabled={p.status !== "ACTIVE"}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 disabled:opacity-40"
            >
              On Hold
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("Kill this project? This cannot be undone.")) updateMutation.mutate({ status: "KILLED" });
              }}
              disabled={p.status === "KILLED" || p.status === "COMPLETED"}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-40"
            >
              Kill Project
            </button>
          </div>
        </div>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">{p.name}</h1>
        {p.description != null && <p className="mt-1 text-sm text-slate-500">{p.description}</p>}
        {p.targetLaunchDate != null && (
          <p className="mt-1 text-xs text-slate-400">
            Target Launch: <span className="font-medium text-slate-600">{new Date(p.targetLaunchDate).toLocaleDateString()}</span>
          </p>
        )}

        {/* Stepper */}
        <div className="mt-6">
          <StageStepper current={p.stage} />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "border-b-2 border-primary text-primary"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Project Details</h3>
            <dl className="space-y-3">
              {[
                { label: "Project Code", value: p.projectCode },
                { label: "Status", value: p.status.replace("_", " ") },
                { label: "Stage", value: currentStageObj?.label ?? p.stage },
                { label: "Container", value: p.container != null ? `${p.container.code} — ${p.container.name}` : "—" },
                { label: "Project Lead", value: p.projectLead?.name ?? "—" },
                { label: "FG Item", value: p.fgItem != null ? `${p.fgItem.itemCode} — ${p.fgItem.name}` : "—" },
                { label: "Formula", value: p.formula != null ? `${p.formula.formulaCode} — ${p.formula.name}` : "—" },
                { label: "Target Launch", value: p.targetLaunchDate != null ? new Date(p.targetLaunchDate).toLocaleDateString() : "—" },
                { label: "Actual Launch", value: p.actualLaunchDate != null ? new Date(p.actualLaunchDate).toLocaleDateString() : "—" },
                { label: "Created", value: new Date(p.createdAt).toLocaleDateString() }
              ].map((row) => (
                <div key={row.label} className="flex justify-between border-b border-slate-50 pb-2 text-sm">
                  <dt className="text-slate-500">{row.label}</dt>
                  <dd className="font-medium text-slate-800">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Gate Progress</h3>
              <div className="space-y-2">
                {STAGES.map((stage, idx) => {
                  const review = p.gateReviews.find((r) => r.gate === stage.key);
                  const decision = review?.decision;
                  return (
                    <div key={stage.key} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{idx + 1}</span>
                        <span className="text-sm text-slate-700">Gate {idx + 1}: {stage.label}</span>
                      </div>
                      {decision !== undefined ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${DECISION_COLORS[decision] ?? "bg-slate-100 text-slate-600"}`}>
                          {decision}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">Pending</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stage Checklist Tab */}
      {activeTab === "checklist" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {deliverables.isLoading && <div className="text-sm text-slate-400">Loading checklist...</div>}
          {deliverables.data !== undefined && (
            <>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Stage Deliverables — {currentStageObj?.label}</h3>
                  <p className="text-xs text-slate-500">{deliverables.data.completeness}% of required deliverables complete</p>
                </div>
                <button
                  type="button"
                  disabled={deliverables.data.completeness < 100}
                  onClick={() => setActiveTab("gatereviews")}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    deliverables.data.completeness >= 100
                      ? "bg-primary text-white hover:bg-primary/90"
                      : "cursor-not-allowed bg-slate-100 text-slate-400"
                  }`}
                >
                  {deliverables.data.completeness >= 100 ? "→ Ready for Gate Review" : "Complete all required items first"}
                </button>
              </div>
              {/* Progress bar */}
              <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    deliverables.data.completeness >= 100 ? "bg-emerald-500" :
                    deliverables.data.completeness >= 60 ? "bg-amber-500" : "bg-red-400"
                  }`}
                  style={{ width: `${deliverables.data.completeness}%` }}
                />
              </div>
              <div className="space-y-2">
                {deliverables.data.deliverables.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-4 py-3">
                    <div className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold
                      ${d.satisfied ? "bg-emerald-500 text-white" : d.required ? "bg-red-100 text-red-600 border border-red-200" : "border border-slate-300 bg-white text-slate-400"}`}>
                      {d.satisfied ? "✓" : d.required ? "!" : "○"}
                    </div>
                    <div className="flex-1">
                      <span className="text-sm text-slate-700">{d.label}</span>
                      {/* Satisfied: show link to the artifact */}
                      {d.satisfied && d.type === "ITEM" && p.fgItem != null && (
                        <Link to={`/items/${p.fgItem.id}`} className="ml-2 text-xs font-mono text-primary hover:underline">
                          {p.fgItem.itemCode} →
                        </Link>
                      )}
                      {d.satisfied && d.type === "FORMULA" && p.formula != null && (
                        <Link to={`/formulas`} className="ml-2 text-xs font-mono text-primary hover:underline">
                          {p.formula.formulaCode} →
                        </Link>
                      )}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[d.type] ?? "bg-slate-100 text-slate-600"}`}>
                      {d.type}
                    </span>
                    {d.required && !d.satisfied && (
                      <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-600">Required</span>
                    )}
                    {/* Action buttons for system-tracked deliverables */}
                    {!d.satisfied && d.type === "FORMULA" && (
                      <button
                        type="button"
                        onClick={() => navigate(`/formulas?fromNpdProjectId=${p.id}&fromNpdProjectCode=${encodeURIComponent(p.projectCode)}&fromNpdProjectName=${encodeURIComponent(p.name)}`)}
                        className="flex-none rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        → Draft Formula
                      </button>
                    )}
                    {!d.satisfied && d.type === "ITEM" && (
                      <button
                        type="button"
                        onClick={() => navigate(`/items?fromNpdProjectId=${p.id}&fromNpdProjectCode=${encodeURIComponent(p.projectCode)}&fromNpdProjectName=${encodeURIComponent(p.name)}`)}
                        className="flex-none rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                      >
                        → Create FG Item
                      </button>
                    )}
                  </div>
                ))}
                {deliverables.data.deliverables.length === 0 && (
                  <p className="py-6 text-center text-sm text-slate-400">No template configured for this stage and industry.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Gate Reviews Tab */}
      {activeTab === "gatereviews" && (
        <div className="space-y-4">
          {STAGES.map((stage, idx) => {
            const review = p.gateReviews.find((r) => r.gate === stage.key);
            const isSelected = selectedGate === stage.key;
            return (
              <div key={stage.key} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-5 py-4"
                  onClick={() => setSelectedGate(isSelected ? null : stage.key)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white ${stage.dotColor}`}>{idx + 1}</span>
                    <span className="font-semibold text-slate-800">Gate {idx + 1}: {stage.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {review?.decision !== undefined ? (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${DECISION_COLORS[review.decision] ?? "bg-slate-100 text-slate-600"}`}>
                        {review.decision}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-400">No review yet</span>
                    )}
                    <span className="text-slate-400">{isSelected ? "▲" : "▼"}</span>
                  </div>
                </button>
                {isSelected && (
                  <div className="border-t border-slate-100 px-5 py-4">
                    {review === undefined ? (
                      <div className="space-y-3">
                        <p className="text-sm text-slate-500">No gate review has been conducted for this stage yet.</p>
                        <p className="text-xs text-slate-400">
                          Complete all stage deliverables, then use the Gate Review modal to record the gate decision.
                        </p>
                        <button
                          type="button"
                          onClick={() => { setGateReviewGate(stage.key); setGateReviewOpen(true); }}
                          className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Conduct Gate Review
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-6 text-sm">
                          <div><span className="text-slate-500">Reviewer:</span> <span className="font-medium">{review.reviewedBy?.name ?? "—"}</span></div>
                          <div><span className="text-slate-500">Date:</span> <span className="font-medium">{review.reviewedAt != null ? new Date(review.reviewedAt).toLocaleDateString() : "—"}</span></div>
                          {review.overallScore !== undefined && (
                            <div>
                              <span className="text-slate-500">Score:</span>
                              <span className="ml-1 font-bold text-primary">{review.overallScore.toFixed(1)}/10</span>
                            </div>
                          )}
                        </div>
                        {review.comments != null && (
                          <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm italic text-slate-600">"{review.comments}"</div>
                        )}
                        <div>
                          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Must-Meet Criteria</h4>
                          <div className="space-y-1">
                            {review.mustMeetCriteria.map((c) => (
                              <div key={c.id} className="flex items-center gap-2 text-sm">
                                <span className={`h-4 w-4 text-center text-xs ${c.passed === true ? "text-emerald-600" : c.passed === false ? "text-red-500" : "text-slate-300"}`}>
                                  {c.passed === true ? "✓" : c.passed === false ? "✗" : "—"}
                                </span>
                                <span className="text-slate-700">{c.criterion}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {review.shouldMeetCriteria.length > 0 && (
                          <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Should-Meet Criteria</h4>
                            <div className="space-y-1">
                              {review.shouldMeetCriteria.map((c) => (
                                <div key={c.id} className="flex items-center justify-between text-sm">
                                  <span className="text-slate-700">{c.criterion}</span>
                                  <span className="font-medium text-primary">{c.score ?? "—"}/10 <span className="text-slate-400">(w:{c.weight})</span></span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Linked Entities Tab */}
      {activeTab === "linked" && (
        <div className="space-y-6">
          {/* Primary links */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Primary FG Item</h3>
              {p.fgItem != null && p.fgItem.itemCode != null ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm font-bold text-slate-800">{p.fgItem.itemCode}</p>
                    <p className="text-sm text-slate-600">{p.fgItem.name}</p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${p.fgItem.status === "RELEASED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {p.fgItem.status}
                    </span>
                  </div>
                  <Link to={`/items/${p.fgItem.id}`} className="text-xs text-primary hover:underline">Open →</Link>
                </div>
              ) : (
                <p className="text-sm text-slate-400">No FG item linked yet.</p>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Primary Formula</h3>
              {p.formula != null ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm font-bold text-slate-800">{p.formula.formulaCode}</p>
                    <p className="text-sm text-slate-600">{p.formula.name}</p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${p.formula.status === "RELEASED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {p.formula.status}
                    </span>
                  </div>
                  <Link to={`/formulas/${p.formula.id}`} className="text-xs text-primary hover:underline">Open →</Link>
                </div>
              ) : (
                <p className="text-sm text-slate-400">No formula linked yet.</p>
              )}
            </div>
          </div>
          {/* Additional linked items */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-1 text-sm font-semibold text-slate-700">Additional Linked Entities</h3>
            <p className="mb-3 text-xs text-slate-400">Link items, formulas, documents and specifications from their respective detail pages.</p>
            <div className="grid gap-4 md:grid-cols-4">
              {[
                { label: "Items", ids: p.linkedItemIds },
                { label: "Formulas", ids: p.linkedFormulaIds },
                { label: "Documents", ids: p.linkedDocumentIds },
                { label: "Specifications", ids: p.linkedSpecIds }
              ].map((section) => (
                <div key={section.label}>
                  <h4 className="mb-2 text-xs font-semibold text-slate-600">{section.label} ({section.ids.length})</h4>
                  {section.ids.length === 0 ? (
                    <p className="text-xs text-slate-400">None linked</p>
                  ) : (
                    <ul className="space-y-1">
                      {section.ids.map((entityId) => (
                        <li key={entityId}><span className="font-mono text-xs text-slate-600">{entityId.slice(0, 12)}…</span></li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === "timeline" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-5 text-sm font-semibold text-slate-700">Gate Review History</h3>
          {p.gateReviews.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No gate reviews yet. Complete stage deliverables and conduct your first gate review.</p>
          ) : (
            <div className="relative space-y-6 pl-6">
              <div className="absolute bottom-2 left-2 top-2 w-px bg-slate-200" />
              {[...p.gateReviews].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((review) => {
                const stageObj = STAGES.find((s) => s.key === review.gate);
                return (
                  <div key={review.id} className="relative">
                    <div className={`absolute -left-4 top-1 h-4 w-4 rounded-full border-2 border-white ${stageObj?.dotColor ?? "bg-slate-400"}`} />
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{stageObj?.label ?? review.gate} Gate</span>
                          {review.decision !== undefined && (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${DECISION_COLORS[review.decision] ?? "bg-slate-100 text-slate-600"}`}>
                              {review.decision}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</span>
                      </div>
                      {review.overallScore != null && (
                        <p className="mt-1 text-sm text-slate-600">
                          Score: <span className="font-bold text-primary">{review.overallScore.toFixed(1)}/10</span>
                        </p>
                      )}
                      {review.reviewedBy != null && (
                        <p className="text-xs text-slate-500">Reviewed by {review.reviewedBy.name}</p>
                      )}
                      {review.comments != null && (
                        <p className="mt-2 text-sm italic text-slate-600">"{review.comments}"</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit Project Panel */}
      {editOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setEditOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-[480px] flex-col bg-white shadow-2xl">
            {/* Panel header */}
            <div className="flex flex-none items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Edit Project</h2>
                <p className="text-xs text-slate-500">{p.projectCode}</p>
              </div>
              <button type="button" onClick={() => setEditOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">✕</button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
                FG Item and Formula are created as part of the stage deliverables — use the Stage Checklist to create them.
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Project Name *</label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Target Launch Date</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={editForm.targetLaunchDate}
                  onChange={(e) => setEditForm((f) => ({ ...f, targetLaunchDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Project Lead (User ID)</label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Paste user ID..."
                  value={editForm.projectLeadId}
                  onChange={(e) => setEditForm((f) => ({ ...f, projectLeadId: e.target.value }))}
                />
              </div>
            </div>

            {/* Panel footer */}
            <div className="flex flex-none items-center justify-between border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!editForm.name.trim() || editMutation.isPending}
                onClick={() => {
                  editMutation.mutate({
                    name: editForm.name.trim(),
                    description: editForm.description.trim() || null,
                    targetLaunchDate: editForm.targetLaunchDate || null,
                    projectLeadId: editForm.projectLeadId.trim() || null
                  });
                }}
                className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${
                  editForm.name.trim() && !editMutation.isPending
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "cursor-not-allowed bg-slate-100 text-slate-400"
                }`}
              >
                {editMutation.isPending ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </>
      )}

      {gateReviewOpen && (
        <GateReviewModal
          projectId={p.id}
          gate={gateReviewGate}
          industry={undefined}
          onClose={() => setGateReviewOpen(false)}
          onSuccess={() => setGateReviewOpen(false)}
        />
      )}
    </div>
  );
}
