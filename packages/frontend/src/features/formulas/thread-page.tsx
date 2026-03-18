import { useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormulaThreadResponse {
  formula: {
    id: string;
    formulaCode: string;
    name: string;
    version: number;
    status: string;
  };
  overallCompleteness: number;
  actionItems: Array<{ nodeType: string; severity: "HIGH" | "MEDIUM" | "LOW"; message: string }>;
  nodes: {
    outputItem: {
      count: number;
      completeness: number;
      maxScore: number;
      issues: string[];
      item: { id: string; itemCode: string; name: string; itemType: string; status: string } | null;
    };
    ingredients: {
      count: number;
      completeness: number;
      maxScore: number;
      issues: string[];
      items: Array<{ id: string; name: string; code: string; quantity: number; uom: string }>;
    };
    documents: {
      count: number;
      completeness: number;
      maxScore: number;
      issues: string[];
      items: Array<{ id: string; docNumber: string; name: string; docType: string; status: string }>;
    };
    specifications: {
      count: number;
      completeness: number;
      maxScore: number;
      issues: string[];
      items: Array<{ id: string; specType: string; attribute: string }>;
    };
    changes: {
      openCount: number;
      criticalCount: number;
      items: Array<{ id: string; crNumber: string; title: string; priority: string; status: string }>;
    };
    releases: {
      latestStatus: string | null;
      items: Array<{ id: string; releaseCode: string; status: string }>;
    };
    npdProjects: {
      count: number;
      activeCount: number;
      items: Array<{ id: string; projectCode: string; name: string; stage: string }>;
    };
  };
}

type NodeKey = "outputItem" | "ingredients" | "documents" | "specifications" | "changes" | "releases" | "npdProjects";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function completenessColor(pct: number): string {
  if (pct >= 80) return "#22c55e";
  if (pct >= 40) return "#f59e0b";
  return "#ef4444";
}

function completenessText(pct: number): string {
  if (pct >= 80) return "text-green-600";
  if (pct >= 40) return "text-amber-600";
  return "text-red-600";
}

function completenessRingColor(pct: number): string {
  if (pct >= 80) return "text-green-500";
  if (pct >= 40) return "text-amber-500";
  return "text-red-500";
}

function nodeStatus(completeness: number, maxScore: number, count: number): "good" | "partial" | "bad" | "missing" {
  if (count === 0) return "missing";
  const pct = maxScore > 0 ? (completeness / maxScore) * 100 : 0;
  if (pct >= 80) return "good";
  if (pct >= 40) return "partial";
  return "bad";
}

function nodeBorderClass(status: "good" | "partial" | "bad" | "missing" | "info"): string {
  if (status === "good") return "border-green-400 bg-green-50";
  if (status === "partial") return "border-amber-400 bg-amber-50";
  if (status === "bad") return "border-red-400 bg-red-50";
  if (status === "missing") return "border-dashed border-slate-300 bg-white";
  return "border-slate-300 bg-slate-50";
}

function nodeIcon(key: NodeKey): string {
  const icons: Record<NodeKey, string> = {
    outputItem: "📦",
    ingredients: "🧫",
    documents: "📄",
    specifications: "📋",
    changes: "🔄",
    releases: "🚀",
    npdProjects: "🔬"
  };
  return icons[key];
}

function nodeLabel(key: NodeKey): string {
  const labels: Record<NodeKey, string> = {
    outputItem: "Output FG Item",
    ingredients: "Ingredients",
    documents: "Documents",
    specifications: "Specifications",
    changes: "Changes",
    releases: "Releases",
    npdProjects: "NPD Projects"
  };
  return labels[key];
}

// ─── Completeness Ring ────────────────────────────────────────────────────────

function CompletenessRing({ value, size = 40, strokeWidth = 4 }: { value: number; size?: number; strokeWidth?: number }): JSX.Element {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  const color = completenessColor(value);
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
    </svg>
  );
}

// ─── Spoke Node ───────────────────────────────────────────────────────────────

interface SpokeNodeProps {
  nodeKey: NodeKey;
  count: number;
  completeness: number;
  maxScore: number;
  issues: string[];
  isSelected: boolean;
  onClick: () => void;
  formulaId: string;
  extraLabel?: string;
}

function SpokeNode({ nodeKey, count, completeness, maxScore, issues, isSelected, onClick, extraLabel }: SpokeNodeProps): JSX.Element {
  const pct = maxScore > 0 ? Math.round((completeness / maxScore) * 100) : 0;
  const status = nodeStatus(completeness, maxScore, count);
  const borderCls = isSelected
    ? "border-primary bg-blue-50 ring-2 ring-primary"
    : nodeBorderClass(status);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-40 flex-col items-center gap-1 rounded-xl border-2 p-3 text-center shadow-sm transition-all hover:shadow-md ${borderCls}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-lg leading-none">{nodeIcon(nodeKey)}</span>
        <span className="text-xs font-semibold text-slate-700">{nodeLabel(nodeKey)}</span>
      </div>
      <div className="flex items-center gap-2">
        <CompletenessRing value={pct} size={32} strokeWidth={3} />
        <span className={`text-sm font-bold ${completenessText(pct)}`}>{pct}%</span>
      </div>
      {extraLabel ? (
        <span className="text-[10px] text-slate-500">{extraLabel}</span>
      ) : count > 0 ? (
        <span className="text-[10px] text-slate-500">{count} {count === 1 ? "item" : "items"}</span>
      ) : (
        <span className="text-[10px] italic text-slate-400">Not set up</span>
      )}
      {issues.length > 0 && status !== "missing" ? (
        <span className="text-[10px] text-amber-600">{issues.length} issue{issues.length > 1 ? "s" : ""}</span>
      ) : null}
      {count === 0 ? (
        <span className="mt-0.5 rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-white">
          + Add
        </span>
      ) : null}
    </button>
  );
}

// ─── Changes Node ─────────────────────────────────────────────────────────────

interface ChangesNodeProps {
  openCount: number;
  criticalCount: number;
  isSelected: boolean;
  onClick: () => void;
}

function ChangesNode({ openCount, criticalCount, isSelected, onClick }: ChangesNodeProps): JSX.Element {
  const status = criticalCount > 0 ? "bad" : openCount > 0 ? "partial" : "good";
  const borderCls = isSelected ? "border-primary bg-blue-50 ring-2 ring-primary" : nodeBorderClass(status);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-40 flex-col items-center gap-1 rounded-xl border-2 p-3 text-center shadow-sm transition-all hover:shadow-md ${borderCls}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-lg leading-none">{nodeIcon("changes")}</span>
        <span className="text-xs font-semibold text-slate-700">Changes</span>
      </div>
      <div className="text-sm font-bold text-slate-600">{openCount} open</div>
      {criticalCount > 0 ? (
        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">{criticalCount} critical</span>
      ) : openCount === 0 ? (
        <span className="text-[10px] text-green-600">No open changes</span>
      ) : (
        <span className="text-[10px] text-amber-600">{openCount} in progress</span>
      )}
    </button>
  );
}

// ─── Releases Node ────────────────────────────────────────────────────────────

interface ReleasesNodeProps {
  latestStatus: string | null;
  itemCount: number;
  isSelected: boolean;
  onClick: () => void;
}

function ReleasesNode({ latestStatus, itemCount, isSelected, onClick }: ReleasesNodeProps): JSX.Element {
  const isReleased = latestStatus === "RELEASED" || latestStatus === "APPROVED";
  const status = isReleased ? "good" : itemCount > 0 ? "partial" : "missing";
  const borderCls = isSelected ? "border-primary bg-blue-50 ring-2 ring-primary" : nodeBorderClass(status);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-40 flex-col items-center gap-1 rounded-xl border-2 p-3 text-center shadow-sm transition-all hover:shadow-md ${borderCls}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-lg leading-none">{nodeIcon("releases")}</span>
        <span className="text-xs font-semibold text-slate-700">Releases</span>
      </div>
      {latestStatus ? (
        <StatusBadge status={latestStatus} />
      ) : (
        <span className="text-[10px] italic text-slate-400">No releases</span>
      )}
      <span className="text-[10px] text-slate-500">{itemCount} total</span>
    </button>
  );
}

// ─── NPD Node ─────────────────────────────────────────────────────────────────

interface NpdNodeProps {
  count: number;
  activeCount: number;
  isSelected: boolean;
  onClick: () => void;
}

function NpdNode({ count, activeCount, isSelected, onClick }: NpdNodeProps): JSX.Element {
  const status = activeCount > 0 ? "good" : count > 0 ? "partial" : "missing";
  const borderCls = isSelected ? "border-primary bg-blue-50 ring-2 ring-primary" : nodeBorderClass(status);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-40 flex-col items-center gap-1 rounded-xl border-2 p-3 text-center shadow-sm transition-all hover:shadow-md ${borderCls}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-lg leading-none">{nodeIcon("npdProjects")}</span>
        <span className="text-xs font-semibold text-slate-700">NPD Projects</span>
      </div>
      <div className="text-sm font-bold text-slate-600">{count}</div>
      {activeCount > 0 ? (
        <span className="text-[10px] text-green-600">{activeCount} active</span>
      ) : count === 0 ? (
        <span className="text-[10px] italic text-slate-400">No projects</span>
      ) : (
        <span className="text-[10px] text-slate-500">None active</span>
      )}
    </button>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  selectedNode: NodeKey | null;
  data: FormulaThreadResponse;
  onClose: () => void;
  formulaId: string;
}

function DetailPanel({ selectedNode, data, onClose, formulaId }: DetailPanelProps): JSX.Element | null {
  const navigate = useNavigate();
  if (!selectedNode) return null;

  const renderContent = () => {
    switch (selectedNode) {
      case "outputItem": {
        const node = data.nodes.outputItem;
        return (
          <div className="space-y-3">
            {node.issues.length > 0 && (
              <div className="rounded bg-amber-50 p-2 text-xs text-amber-700">
                {node.issues.map((issue) => <p key={issue}>⚠ {issue}</p>)}
              </div>
            )}
            {!node.item ? (
              <div className="space-y-2 text-center">
                <p className="text-sm text-slate-500">No Finished Good item linked to this formula yet.</p>
                <p className="text-xs text-slate-400">Link a Finished Good item via the FG Structure module.</p>
                <button
                  type="button"
                  onClick={() => navigate(`/fg?fromFormulaId=${encodeURIComponent(formulaId)}`)}
                  className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white"
                >
                  Set Up FG Structure
                </button>
              </div>
            ) : (
              <Link
                to={`/items/${node.item.id}`}
                className="block rounded border border-slate-200 bg-white p-3 hover:border-primary"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-500">{node.item.itemCode}</span>
                  <StatusBadge status={node.item.status} />
                </div>
                <p className="mt-0.5 text-sm font-medium text-slate-700">{node.item.name}</p>
                <p className="text-xs text-slate-400">{node.item.itemType.replace(/_/g, " ")}</p>
              </Link>
            )}
          </div>
        );
      }
      case "ingredients": {
        const node = data.nodes.ingredients;
        return (
          <div className="space-y-3">
            {node.issues.length > 0 && (
              <div className="rounded bg-amber-50 p-2 text-xs text-amber-700">
                {node.issues.map((issue) => <p key={issue}>⚠ {issue}</p>)}
              </div>
            )}
            {node.items.length === 0 ? (
              <div className="space-y-2 text-center">
                <p className="text-sm text-slate-500">No ingredients defined.</p>
                <button
                  type="button"
                  onClick={() => navigate(`/formulas/${formulaId}`)}
                  className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white"
                >
                  Add Ingredients
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500">{node.count} ingredient{node.count !== 1 ? "s" : ""} total</p>
                {node.items.slice(0, 10).map((ing) => (
                  <div key={ing.id} className="rounded border border-slate-200 bg-white p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-slate-400">{ing.code}</span>
                      <span className="text-xs font-medium text-slate-600">{ing.quantity} {ing.uom}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-700">{ing.name}</p>
                  </div>
                ))}
                {node.items.length > 10 && (
                  <p className="text-center text-xs text-slate-400">+{node.items.length - 10} more</p>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/formulas/${formulaId}`)}
                  className="w-full rounded border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-blue-50"
                >
                  Edit Ingredients
                </button>
              </>
            )}
          </div>
        );
      }
      case "documents": {
        const node = data.nodes.documents;
        return (
          <div className="space-y-3">
            {node.issues.length > 0 && (
              <div className="rounded bg-amber-50 p-2 text-xs text-amber-700">
                {node.issues.map((issue) => <p key={issue}>⚠ {issue}</p>)}
              </div>
            )}
            {node.items.length === 0 ? (
              <div className="space-y-2 text-center">
                <p className="text-sm text-slate-500">No documents linked to this formula.</p>
                <button
                  type="button"
                  onClick={() => navigate(`/documents?fromFormulaId=${encodeURIComponent(formulaId)}&fromFormulaCode=${encodeURIComponent(data.formula.formulaCode)}`)}
                  className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white"
                >
                  Upload Document
                </button>
              </div>
            ) : (
              node.items.map((d) => (
                <Link
                  key={d.id}
                  to={`/documents/${d.id}`}
                  className="block rounded border border-slate-200 bg-white p-3 hover:border-primary"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-500">{d.docNumber}</span>
                    <StatusBadge status={d.status} />
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-slate-700">{d.name}</p>
                  <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{d.docType}</span>
                </Link>
              ))
            )}
          </div>
        );
      }
      case "specifications": {
        const node = data.nodes.specifications;
        return (
          <div className="space-y-3">
            {node.issues.length > 0 && (
              <div className="rounded bg-amber-50 p-2 text-xs text-amber-700">
                {node.issues.map((issue) => <p key={issue}>⚠ {issue}</p>)}
              </div>
            )}
            <div className="rounded border border-slate-200 bg-white p-3">
              <p className="text-sm text-slate-700">{node.count} specification{node.count !== 1 ? "s" : ""} defined</p>
              {node.count === 0 && (
                <p className="mt-1 text-xs text-slate-400">Add quality specs such as physical, chemical, or regulatory parameters.</p>
              )}
            </div>
            {node.items.slice(0, 8).map((s) => (
              <div key={s.id} className="rounded border border-slate-200 bg-white px-3 py-2">
                <span className="inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">{s.specType}</span>
                <p className="mt-0.5 text-xs text-slate-700">{s.attribute}</p>
              </div>
            ))}
            {node.items.length > 8 && (
              <p className="text-center text-xs text-slate-400">+{node.items.length - 8} more</p>
            )}
            <button
              type="button"
              onClick={() => navigate(`/formulas/${formulaId}`)}
              className="w-full rounded border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-blue-50"
            >
              Manage Specifications
            </button>
          </div>
        );
      }
      case "changes": {
        const node = data.nodes.changes;
        return (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate(`/changes?fromFormulaId=${encodeURIComponent(formulaId)}&fromFormulaCode=${encodeURIComponent(data.formula.formulaCode)}&fromFormulaName=${encodeURIComponent(data.formula.name)}`)}
              className="w-full rounded bg-primary px-3 py-1.5 text-sm font-medium text-white"
            >
              + Create Change Request
            </button>
            {node.items.length === 0 ? (
              <p className="text-sm text-slate-500">No open change requests for this formula.</p>
            ) : (
              node.items.map((c) => (
                <Link
                  key={c.id}
                  to={`/changes/${c.id}`}
                  className="block rounded border border-slate-200 bg-white p-3 hover:border-primary"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-500">{c.crNumber}</span>
                    <div className="flex items-center gap-1">
                      <StatusBadge status={c.priority} />
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-slate-700">{c.title}</p>
                </Link>
              ))
            )}
          </div>
        );
      }
      case "releases": {
        const node = data.nodes.releases;
        return (
          <div className="space-y-3">
            {node.items.length === 0 ? (
              <div className="space-y-2 text-center">
                <p className="text-sm text-slate-500">No release requests for this formula.</p>
                <button
                  type="button"
                  onClick={() => navigate(`/releases?fromFormulaId=${encodeURIComponent(formulaId)}&fromFormulaCode=${encodeURIComponent(data.formula.formulaCode)}&fromFormulaName=${encodeURIComponent(data.formula.name)}`)}
                  className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white"
                >
                  Create Release Request
                </button>
              </div>
            ) : (
              node.items.map((r) => (
                <Link
                  key={r.id}
                  to={`/releases/${r.id}`}
                  className="block rounded border border-slate-200 bg-white p-3 hover:border-primary"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-500">{r.releaseCode}</span>
                    <StatusBadge status={r.status} />
                  </div>
                </Link>
              ))
            )}
          </div>
        );
      }
      case "npdProjects": {
        const node = data.nodes.npdProjects;
        const stageBg: Record<string, string> = {
          DISCOVERY: "bg-slate-100 text-slate-700",
          FEASIBILITY: "bg-blue-100 text-blue-700",
          DEVELOPMENT: "bg-purple-100 text-purple-700",
          VALIDATION: "bg-amber-100 text-amber-700",
          LAUNCH: "bg-green-100 text-green-700"
        };
        return (
          <div className="space-y-3">
            <div className="flex gap-4 text-sm">
              <div>
                <span className="font-bold text-slate-700">{node.count}</span>
                <span className="ml-1 text-slate-500">total</span>
              </div>
              <div>
                <span className="font-bold text-green-600">{node.activeCount}</span>
                <span className="ml-1 text-slate-500">active</span>
              </div>
            </div>
            {node.items.length === 0 ? (
              <div className="space-y-2 text-center">
                <p className="text-sm text-slate-500">No NPD projects linked to this formula.</p>
                <button
                  type="button"
                  onClick={() => navigate(`/npd`)}
                  className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white"
                >
                  View NPD Projects
                </button>
              </div>
            ) : (
              node.items.map((p) => (
                <Link
                  key={p.id}
                  to={`/npd/${p.id}`}
                  className="block rounded border border-slate-200 bg-white p-3 hover:border-primary"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-500">{p.projectCode}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${stageBg[p.stage] ?? "bg-slate-100 text-slate-700"}`}>
                      {p.stage}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-slate-700">{p.name}</p>
                </Link>
              ))
            )}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{nodeIcon(selectedNode)}</span>
          <h3 className="font-semibold text-slate-800">{nodeLabel(selectedNode)}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {renderContent()}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function FormulaThreadPage(): JSX.Element {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const formulaId = String(params.id ?? "");
  const nodeParam = searchParams.get("node") as NodeKey | null;
  const [selectedNode, setSelectedNode] = useState<NodeKey | null>(nodeParam);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

  const thread = useQuery({
    queryKey: ["formula-product-thread", formulaId],
    queryFn: async () => (await api.get<FormulaThreadResponse>(`/formulas/${formulaId}/product-thread`)).data,
    enabled: Boolean(formulaId)
  });

  const dataReady = !!thread.data;
  useLayoutEffect(() => {
    if (!dataReady) return;
    const el = containerRef.current;
    if (!el) return;
    setCanvasSize({ w: el.offsetWidth, h: el.offsetHeight });
    const obs = new ResizeObserver(() => {
      setCanvasSize({ w: el.offsetWidth, h: el.offsetHeight });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [dataReady]);

  const handleNodeClick = (key: NodeKey) => {
    setSelectedNode((prev) => (prev === key ? null : key));
  };

  if (thread.isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-slate-500">Loading formula thread...</p>
      </div>
    );
  }

  if (thread.error || !thread.data) {
    const msg = (thread.error as Error)?.message ?? "Failed to load";
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <p className="text-red-600">{msg}</p>
        <Link to={`/formulas/${formulaId}`} className="text-sm text-primary underline">
          Back to formula
        </Link>
      </div>
    );
  }

  const { formula, overallCompleteness, actionItems, nodes } = thread.data;

  const cx = canvasSize.w / 2;
  const cy = canvasSize.h / 2;
  const radius = Math.min(cx, cy) * 0.65;
  const NODE_KEYS: NodeKey[] = ["outputItem", "ingredients", "documents", "specifications", "changes", "releases", "npdProjects"];
  const angleStep = (2 * Math.PI) / NODE_KEYS.length;
  const startAngle = -Math.PI / 2;

  const nodePositions = NODE_KEYS.map((key, i) => {
    const angle = startAngle + i * angleStep;
    return {
      key,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle)
    };
  });

  const overallColor = completenessColor(overallCompleteness);
  const highIssues = actionItems.filter((a) => a.severity === "HIGH");
  const mediumIssues = actionItems.filter((a) => a.severity === "MEDIUM");

  const getLineColor = (key: NodeKey): string => {
    const node = nodes[key];
    if (key === "changes") return nodes.changes.openCount > 0 ? completenessColor(nodes.changes.criticalCount > 0 ? 0 : 50) : "#22c55e";
    if (key === "releases") return nodes.releases.latestStatus === "RELEASED" ? "#22c55e" : "#f59e0b";
    if (key === "npdProjects") return nodes.npdProjects.count > 0 ? "#22c55e" : "#cbd5e1";
    const n = node as { count: number; completeness: number; maxScore: number };
    return n.count === 0 ? "#cbd5e1" : completenessColor((n.completeness / n.maxScore) * 100);
  };

  const getLineDash = (key: NodeKey): string | undefined => {
    const node = nodes[key];
    if (key === "changes") return undefined;
    if (key === "releases") return nodes.releases.items.length === 0 ? "6 4" : undefined;
    if (key === "npdProjects") return nodes.npdProjects.count === 0 ? "6 4" : undefined;
    const n = node as { count: number };
    return n.count === 0 ? "6 4" : undefined;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            to={`/formulas/${formulaId}`}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            ← Back to formula
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/70">Formula Digital Thread</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-slate-400">{formula.formulaCode} v{formula.version}</span>
              <span className="text-slate-300">·</span>
              <h1 className="text-lg font-semibold text-slate-800">{formula.name}</h1>
            </div>
          </div>
          <StatusBadge status={formula.status} />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <CompletenessRing value={overallCompleteness} size={48} strokeWidth={5} />
            <div>
              <p className={`text-xl font-bold ${completenessRingColor(overallCompleteness)}`}>{overallCompleteness}%</p>
              <p className="text-xs text-slate-400">complete</p>
            </div>
          </div>
          {actionItems.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs font-medium text-amber-700">
                {highIssues.length > 0 && <span className="mr-2">🔴 {highIssues.length} critical</span>}
                {mediumIssues.length > 0 && <span>🟡 {mediumIssues.length} medium</span>}
              </p>
              <p className="text-[10px] text-amber-600">action{actionItems.length !== 1 ? "s" : ""} needed</p>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div ref={containerRef} className="relative flex-1" style={{ minHeight: 520 }}>
          {canvasSize.w === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-slate-400">Initialising…</p>
            </div>
          )}
          {canvasSize.w > 0 && (
            <>
              {/* SVG lines */}
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                <defs>
                  <marker id="arrowhead-formula" markerWidth="6" markerHeight="4" refX="3" refY="2" orient="auto">
                    <polygon points="0 0, 6 2, 0 4" fill="#cbd5e1" />
                  </marker>
                </defs>
                {nodePositions.map(({ key, x, y }) => {
                  const color = getLineColor(key);
                  const dash = getLineDash(key);
                  const isSelected = selectedNode === key;
                  return (
                    <line
                      key={key}
                      x1={cx}
                      y1={cy}
                      x2={x}
                      y2={y}
                      stroke={isSelected ? "#3b82f6" : color}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      strokeOpacity={0.6}
                      strokeDasharray={dash}
                    />
                  );
                })}
              </svg>

              {/* Center node */}
              <div
                className="absolute rounded-full bg-white"
                style={{
                  width: 140,
                  height: 140,
                  left: cx - 70,
                  top: cy - 70,
                  boxShadow: `0 0 0 4px ${overallColor}40, 0 4px 24px rgba(0,0,0,0.1)`
                }}
              >
                <CompletenessRing value={overallCompleteness} size={140} strokeWidth={7} />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 p-3 text-center">
                  <span className="font-mono text-[9px] font-medium text-slate-400">{formula.formulaCode} v{formula.version}</span>
                  <span className="line-clamp-2 text-xs font-bold leading-tight text-slate-700">{formula.name}</span>
                  <span className={`text-sm font-bold ${completenessText(overallCompleteness)}`}>{overallCompleteness}%</span>
                </div>
              </div>

              {/* Spoke nodes */}
              {nodePositions.map(({ key, x, y }) => {
                const style: React.CSSProperties = { left: x, top: y, transform: "translate(-50%, -50%)" };

                if (key === "changes") {
                  return (
                    <div key={key} className="absolute" style={style}>
                      <ChangesNode
                        openCount={nodes.changes.openCount}
                        criticalCount={nodes.changes.criticalCount}
                        isSelected={selectedNode === key}
                        onClick={() => handleNodeClick(key)}
                      />
                    </div>
                  );
                }
                if (key === "releases") {
                  return (
                    <div key={key} className="absolute" style={style}>
                      <ReleasesNode
                        latestStatus={nodes.releases.latestStatus}
                        itemCount={nodes.releases.items.length}
                        isSelected={selectedNode === key}
                        onClick={() => handleNodeClick(key)}
                      />
                    </div>
                  );
                }
                if (key === "npdProjects") {
                  return (
                    <div key={key} className="absolute" style={style}>
                      <NpdNode
                        count={nodes.npdProjects.count}
                        activeCount={nodes.npdProjects.activeCount}
                        isSelected={selectedNode === key}
                        onClick={() => handleNodeClick(key)}
                      />
                    </div>
                  );
                }

                const node = nodes[key as keyof Omit<typeof nodes, "changes" | "releases" | "npdProjects">] as {
                  count: number;
                  completeness: number;
                  maxScore: number;
                  issues: string[];
                };

                return (
                  <div key={key} className="absolute" style={style}>
                    <SpokeNode
                      nodeKey={key}
                      count={node.count}
                      completeness={node.completeness}
                      maxScore={node.maxScore}
                      issues={node.issues}
                      isSelected={selectedNode === key}
                      onClick={() => handleNodeClick(key)}
                      formulaId={formulaId}
                    />
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Detail panel */}
        {selectedNode !== null && (
          <DetailPanel
            selectedNode={selectedNode}
            data={thread.data}
            onClose={() => setSelectedNode(null)}
            formulaId={formulaId}
          />
        )}
      </div>

      {/* Action items footer */}
      {actionItems.length > 0 && (
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Action Items</p>
          <div className="flex flex-wrap gap-2">
            {actionItems.map((action, i) => {
              const bg =
                action.severity === "HIGH"
                  ? "bg-red-50 text-red-700 border-red-200"
                  : action.severity === "MEDIUM"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-slate-100 text-slate-600 border-slate-200";
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleNodeClick(action.nodeType as NodeKey)}
                  className={`rounded-full border px-3 py-1 text-xs ${bg}`}
                >
                  {action.severity === "HIGH" ? "🔴" : action.severity === "MEDIUM" ? "🟡" : "⚪"} {action.message}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
