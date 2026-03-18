import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

type NpdStage = "DISCOVERY" | "FEASIBILITY" | "DEVELOPMENT" | "VALIDATION" | "LAUNCH";
type GateDecision = "GO" | "KILL" | "HOLD" | "RECYCLE";

const STAGE_LABELS: Record<NpdStage, string> = {
  DISCOVERY: "Discovery",
  FEASIBILITY: "Feasibility",
  DEVELOPMENT: "Development",
  VALIDATION: "Validation",
  LAUNCH: "Launch"
};

const DECISION_CONFIG: Array<{ key: GateDecision; label: string; icon: string; bg: string; border: string; text: string; activeBg: string }> = [
  { key: "GO", label: "GO", icon: "▶", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", activeBg: "bg-emerald-500 text-white border-emerald-500" },
  { key: "HOLD", label: "ON HOLD", icon: "⏸", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", activeBg: "bg-amber-500 text-white border-amber-500" },
  { key: "RECYCLE", label: "RECYCLE", icon: "↺", bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", activeBg: "bg-orange-500 text-white border-orange-500" },
  { key: "KILL", label: "KILL", icon: "✕", bg: "bg-red-50", border: "border-red-200", text: "text-red-700", activeBg: "bg-red-500 text-white border-red-500" }
];

interface MustMeetCriterion {
  id: string;
  criterion: string;
  passed: boolean | null;
}

interface ShouldMeetCriterion {
  id: string;
  criterion: string;
  score: number | null;
  weight: number;
}

interface StageTemplate {
  mustMeetCriteria: Array<{ id: string; criterion: string }>;
  shouldMeetCriteria: Array<{ id: string; criterion: string; weight: number }>;
}

interface TemplateResponse {
  data: Array<{
    stage: NpdStage;
    industry: string;
    mustMeetCriteria: Array<{ id: string; criterion: string }>;
    shouldMeetCriteria: Array<{ id: string; criterion: string; weight: number }>;
  }>;
}

export interface GateReviewModalProps {
  projectId: string;
  gate: NpdStage;
  industry?: string | undefined;
  onClose: () => void;
  onSuccess: () => void;
}

function ScoreChip({ score }: { score: number | null }): JSX.Element {
  if (score === null) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">—</span>;
  const color = score >= 8 ? "bg-emerald-100 text-emerald-700" : score >= 5 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${color}`}>{score.toFixed(1)}</span>;
}

export function GateReviewModal({ projectId, gate, industry, onClose, onSuccess }: GateReviewModalProps): JSX.Element {
  const queryClient = useQueryClient();

  const templateQuery = useQuery({
    queryKey: ["npd-template", industry, gate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (industry) params.set("industry", industry);
      const resp = await api.get<TemplateResponse>(`/npd/templates?${params.toString()}`);
      const found = resp.data.data.find((t) => t.stage === gate);
      return found ?? null;
    }
  });

  const [mustMeet, setMustMeet] = useState<MustMeetCriterion[]>([]);
  const [shouldMeet, setShouldMeet] = useState<ShouldMeetCriterion[]>([]);
  const [decision, setDecision] = useState<GateDecision | null>(null);
  const [comments, setComments] = useState("");

  // Initialize criteria from template once loaded
  useEffect(() => {
    if (!templateQuery.data) return;
    if (templateQuery.data.mustMeetCriteria.length > 0) {
      setMustMeet(templateQuery.data.mustMeetCriteria.map((c) => ({ ...c, passed: null })));
    }
    if (templateQuery.data.shouldMeetCriteria.length > 0) {
      setShouldMeet(templateQuery.data.shouldMeetCriteria.map((c) => ({ ...c, score: null })));
    }
  }, [templateQuery.data]);

  // Computed
  const allMustMeetsPassed = mustMeet.length === 0 || mustMeet.every((c) => c.passed === true);
  const anyMustMeetNull = mustMeet.some((c) => c.passed === null);

  const totalWeight = shouldMeet.reduce((s, c) => s + c.weight, 0);
  const weightedScore = shouldMeet.reduce((s, c) => s + (c.score ?? 0) * c.weight, 0);
  const estimatedScore = totalWeight > 0 ? weightedScore / totalWeight : null;

  const canSubmitGo = decision === "GO" && allMustMeetsPassed && !anyMustMeetNull;
  const canSubmitOther = decision !== null && decision !== "GO";
  const canSubmit = canSubmitGo || canSubmitOther;

  const submitMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/npd/projects/${projectId}/gate-reviews`, {
        gate,
        decision: decision ?? undefined,
        mustMeetCriteria: mustMeet,
        shouldMeetCriteria: shouldMeet,
        comments: comments.trim() || undefined
      });
    },
    onSuccess: () => {
      toast.success(`Gate review submitted — Decision: ${decision ?? "None"}`);
      void queryClient.invalidateQueries({ queryKey: ["npd-project", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["npd-projects"] });
      onSuccess();
    },
    onError: () => toast.error("Failed to submit gate review")
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-auto my-8 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex flex-none items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Gate Review</h2>
            <p className="text-sm text-slate-500">Gate {Object.keys(STAGE_LABELS).indexOf(gate) + 1}: {STAGE_LABELS[gate]}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {templateQuery.isLoading && (
            <div className="py-8 text-center text-sm text-slate-400">Loading gate criteria...</div>
          )}

          {!templateQuery.isLoading && (
            <>
              {/* Must-Meet */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800">Must-Meet Criteria</h3>
                  <span className="text-xs text-slate-400">All must be PASS to approve GO</span>
                </div>
                {anyMustMeetNull && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    ⚠ Answer all must-meet criteria before selecting GO.
                  </div>
                )}
                {mustMeet.length === 0 && (
                  <p className="text-sm text-slate-400">No must-meet criteria defined for this stage template.</p>
                )}
                <div className="space-y-2">
                  {mustMeet.map((c, idx) => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
                      <span className="flex-1 pr-4 text-sm text-slate-700">{c.criterion}</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...mustMeet];
                            if (next[idx]) next[idx] = { ...next[idx]!, passed: true };
                            setMustMeet(next);
                          }}
                          className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                            c.passed === true
                              ? "bg-emerald-500 text-white border-emerald-500"
                              : "border-slate-200 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50"
                          }`}
                        >
                          ✓ Pass
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...mustMeet];
                            if (next[idx]) next[idx] = { ...next[idx]!, passed: false };
                            setMustMeet(next);
                          }}
                          className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                            c.passed === false
                              ? "bg-red-500 text-white border-red-500"
                              : "border-slate-200 text-slate-500 hover:border-red-300 hover:bg-red-50"
                          }`}
                        >
                          ✗ Fail
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Should-Meet */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800">Should-Meet Criteria</h3>
                  {estimatedScore !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Weighted Score:</span>
                      <ScoreChip score={estimatedScore} />
                    </div>
                  )}
                </div>
                {shouldMeet.length === 0 && (
                  <p className="text-sm text-slate-400">No should-meet criteria defined for this stage template.</p>
                )}
                <div className="space-y-3">
                  {shouldMeet.map((c, idx) => (
                    <div key={c.id} className="rounded-lg border border-slate-100 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="flex-1 pr-4 text-sm text-slate-700">{c.criterion}</span>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">w: {c.weight}</span>
                          <ScoreChip score={c.score} />
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={10}
                          step={0.5}
                          value={c.score ?? 0}
                          onChange={(e) => {
                            const next = [...shouldMeet];
                            if (next[idx]) next[idx] = { ...next[idx]!, score: parseFloat(e.target.value) };
                            setShouldMeet(next);
                          }}
                          className="flex-1 accent-primary"
                        />
                        <input
                          type="number"
                          min={0}
                          max={10}
                          step={0.5}
                          value={c.score ?? ""}
                          placeholder="0–10"
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            const next = [...shouldMeet];
                            if (next[idx]) next[idx] = { ...next[idx]!, score: isNaN(val) ? null : Math.min(10, Math.max(0, val)) };
                            setShouldMeet(next);
                          }}
                          className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Decision */}
              <section>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Gate Decision</h3>
                {decision === "GO" && !allMustMeetsPassed && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    ✗ Cannot select GO — not all must-meet criteria are passed.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {DECISION_CONFIG.map((d) => {
                    const isActive = decision === d.key;
                    const isGoDisabled = d.key === "GO" && !allMustMeetsPassed;
                    return (
                      <button
                        key={d.key}
                        type="button"
                        disabled={isGoDisabled}
                        onClick={() => setDecision(isActive ? null : d.key)}
                        className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-4 text-sm font-bold transition ${
                          isActive
                            ? d.activeBg
                            : isGoDisabled
                            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300"
                            : `${d.bg} ${d.border} ${d.text} hover:opacity-80`
                        }`}
                      >
                        <span className="text-lg">{d.icon}</span>
                        {d.label}
                      </button>
                    );
                  })}
                </div>

                {/* Comments */}
                <div className="mt-4">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Gate Review Comments</label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    rows={3}
                    placeholder="Add key discussion points, conditions, or rationale for this gate decision..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-none items-center justify-between border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            {!canSubmit && decision && (
              <span className="text-xs text-red-500">
                {decision === "GO" ? "Resolve all failed must-meet criteria first" : "Select a decision to submit"}
              </span>
            )}
            <button
              type="button"
              disabled={!canSubmit || submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
              className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${
                canSubmit && !submitMutation.isPending
                  ? "bg-primary text-white hover:bg-primary/90"
                  : "cursor-not-allowed bg-slate-100 text-slate-400"
              }`}
            >
              {submitMutation.isPending ? "Submitting..." : `Submit ${decision ?? "Review"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
