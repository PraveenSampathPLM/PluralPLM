import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductThreadResponse {
  item: {
    id: string;
    itemCode: string;
    name: string;
    itemType: string;
    status: string;
    revisionLabel: string;
  };
  overallCompleteness: number;
  actionItems: Array<{ nodeType: string; severity: "HIGH" | "MEDIUM" | "LOW"; message: string }>;
  nodes: {
    formula: {
      count: number;
      completeness: number;
      maxScore: number;
      issues: string[];
      items: Array<{ id: string; formulaCode: string; version: number; name: string; status: string; ingredientCount: number }>;
    };
    fgStructure: {
      count: number;
      completeness: number;
      maxScore: number;
      issues: string[];
      items: Array<{ id: string; version: number; revisionLabel: string; status: string; packagingLineCount: number; formulaCode: string | null }>;
    };
    artwork: {
      count: number;
      completeness: number;
      maxScore: number;
      issues: string[];
      items: Array<{ id: string; artworkCode: string; title: string; status: string; revisionLabel: string; fileCount: number; componentCount: number }>;
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
    };
    changes: {
      openCount: number;
      criticalCount: number;
      items: Array<{ id: string; crNumber: string; title: string; priority: string; status: string }>;
    };
    releases: {
      latestStatus: string | null;
      items: Array<{ id: string; rrNumber: string; title: string; status: string }>;
    };
  };
}

type NodeKey = "formula" | "fgStructure" | "artwork" | "documents" | "specifications" | "changes" | "releases";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function completenessColor(pct: number): string {
  if (pct >= 80) return "#22c55e"; // green-500
  if (pct >= 40) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
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

function nodeStatus(node: { count?: number; completeness: number; maxScore: number }): "good" | "partial" | "bad" | "missing" {
  if ((node.count ?? 0) === 0) return "missing";
  const pct = (node.completeness / node.maxScore) * 100;
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
    formula: "🧪",
    fgStructure: "📦",
    artwork: "🎨",
    documents: "📄",
    specifications: "📋",
    changes: "🔄",
    releases: "🚀"
  };
  return icons[key];
}

function nodeLabel(key: NodeKey): string {
  const labels: Record<NodeKey, string> = {
    formula: "Formula",
    fgStructure: "FG Structure",
    artwork: "Artwork",
    documents: "Documents",
    specifications: "Specifications",
    changes: "Changes",
    releases: "Releases"
  };
  return labels[key];
}

function nodeCreatePath(key: NodeKey, itemId: string): string {
  const paths: Record<NodeKey, string> = {
    formula: "/formulas",
    fgStructure: `/items/${itemId}?tab=structure`,
    artwork: "/artworks",
    documents: "/documents",
    specifications: `/items/${itemId}?tab=specs`,
    changes: "/changes",
    releases: "/releases"
  };
  return paths[key];
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

// ─── Spoke Node Card ──────────────────────────────────────────────────────────

interface SpokeNodeProps {
  nodeKey: NodeKey;
  count: number;
  completeness: number;
  maxScore: number;
  issues: string[];
  isSelected: boolean;
  onClick: () => void;
  itemId: string;
  extraLabel?: string;
}

function SpokeNode({ nodeKey, count, completeness, maxScore, issues, isSelected, onClick, itemId, extraLabel }: SpokeNodeProps): JSX.Element {
  const navigate = useNavigate();
  const pct = maxScore > 0 ? Math.round((completeness / maxScore) * 100) : 0;
  const status = count === 0 ? "missing" : nodeStatus({ count, completeness, maxScore });
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
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); navigate(nodeCreatePath(nodeKey, itemId)); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); navigate(nodeCreatePath(nodeKey, itemId)); } }}
          className="mt-0.5 rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-white hover:bg-primary/90"
        >
          + Add
        </span>
      ) : null}
    </button>
  );
}

// ─── Changes node card (different scoring) ─────────────────────────────────────

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

// ─── Releases node card ────────────────────────────────────────────────────────

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

// ─── Detail Panel ──────────────────────────────────────────────────────────────

interface DetailPanelProps {
  selectedNode: NodeKey | null;
  data: ProductThreadResponse;
  onClose: () => void;
  itemId: string;
}

function DetailPanel({ selectedNode, data, onClose, itemId }: DetailPanelProps): JSX.Element | null {
  const navigate = useNavigate();
  if (!selectedNode) return null;

  const renderContent = () => {
    switch (selectedNode) {
      case "formula": {
        const node = data.nodes.formula;
        return (
          <div className="space-y-3">
            {node.issues.length > 0 && (
              <div className="rounded bg-amber-50 p-2 text-xs text-amber-700">
                {node.issues.map((issue) => <p key={issue}>⚠ {issue}</p>)}
              </div>
            )}
            {node.items.length === 0 ? (
              <div className="space-y-2 text-center">
                <p className="text-sm text-slate-500">No formula linked via FG Structure.</p>
                <button
                  type="button"
                  onClick={() => navigate("/formulas")}
                  className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white"
                >
                  Create Formula
                </button>
                <p className="text-xs text-slate-400">After creating a formula, link it via the FG Structure tab.</p>
              </div>
            ) : (
              node.items.map((f) => (
                <Link key={f.id} to={`/formulas/${f.id}`} className="block rounded border border-slate-200 bg-white p-3 hover:border-primary">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-500">{f.formulaCode} v{f.version}</span>
                    <StatusBadge status={f.status} />
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-slate-700">{f.name}</p>
                  <p className="text-xs text-slate-400">{f.ingredientCount} ingredient{f.ingredientCount !== 1 ? "s" : ""}</p>
                </Link>
              ))
            )}
          </div>
        );
      }
      case "fgStructure": {
        const node = data.nodes.fgStructure;
        return (
          <div className="space-y-3">
            {node.issues.length > 0 && (
              <div className="rounded bg-amber-50 p-2 text-xs text-amber-700">
                {node.issues.map((issue) => <p key={issue}>⚠ {issue}</p>)}
              </div>
            )}
            {node.items.length === 0 ? (
              <div className="space-y-2 text-center">
                <p className="text-sm text-slate-500">No FG Structure defined yet.</p>
                <button
                  type="button"
                  onClick={() => navigate(`/items/${itemId}`)}
                  className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white"
                >
                  Set Up FG Structure
                </button>
              </div>
            ) : (
              node.items.map((fg) => (
                <Link key={fg.id} to={`/fg/${fg.id}`} className="block rounded border border-slate-200 bg-white p-3 hover:border-primary">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-500">v{fg.version} · {fg.revisionLabel}</span>
                    <StatusBadge status={fg.status} />
                  </div>
                  {fg.formulaCode && <p className="mt-0.5 text-xs text-slate-500">Formula: {fg.formulaCode}</p>}
                  <p className="text-xs text-slate-400">{fg.packagingLineCount} packaging line{fg.packagingLineCount !== 1 ? "s" : ""}</p>
                </Link>
              ))
            )}
          </div>
        );
      }
      case "artwork": {
        const node = data.nodes.artwork;
        return (
          <div className="space-y-3">
            {node.issues.length > 0 && (
              <div className="rounded bg-amber-50 p-2 text-xs text-amber-700">
                {node.issues.map((issue) => <p key={issue}>⚠ {issue}</p>)}
              </div>
            )}
            {node.items.length === 0 ? (
              <div className="space-y-2 text-center">
                <p className="text-sm text-slate-500">No artwork linked to this product.</p>
                <button
                  type="button"
                  onClick={() => navigate(`/artworks?fromItemId=${encodeURIComponent(itemId)}&fromItemCode=${encodeURIComponent(data.item.itemCode)}`)}
                  className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white"
                >
                  Create Artwork
                </button>
              </div>
            ) : (
              node.items.map((a) => (
                <Link key={a.id} to={`/artworks/${a.id}`} className="block rounded border border-slate-200 bg-white p-3 hover:border-primary">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-500">{a.artworkCode} · {a.revisionLabel}</span>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-slate-700">{a.title}</p>
                  <p className="text-xs text-slate-400">{a.componentCount} component{a.componentCount !== 1 ? "s" : ""} · {a.fileCount} file{a.fileCount !== 1 ? "s" : ""}</p>
                </Link>
              ))
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
                <p className="text-sm text-slate-500">No documents linked to this product.</p>
                <button
                  type="button"
                  onClick={() => navigate(`/documents?fromItemId=${encodeURIComponent(itemId)}&fromItemCode=${encodeURIComponent(data.item.itemCode)}`)}
                  className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white"
                >
                  Upload Document
                </button>
              </div>
            ) : (
              node.items.map((d) => (
                <Link key={d.id} to={`/documents/${d.id}`} className="block rounded border border-slate-200 bg-white p-3 hover:border-primary">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-500">{d.docNumber}</span>
                    <StatusBadge status={d.status} />
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-slate-700">{d.name}</p>
                  <p className="text-xs text-slate-400">{d.docType}</p>
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
              {node.count === 0 && <p className="mt-1 text-xs text-slate-400">Add quality specs like physical, chemical, or regulatory parameters.</p>}
            </div>
            <button
              type="button"
              onClick={() => navigate(`/items/${itemId}`)}
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
              onClick={() => navigate(`/changes?fromItemId=${encodeURIComponent(itemId)}&fromItemCode=${encodeURIComponent(data.item.itemCode)}&fromItemName=${encodeURIComponent(data.item.name)}`)}
              className="w-full rounded bg-primary px-3 py-1.5 text-sm font-medium text-white"
            >
              + Create Change Request
            </button>
            {node.items.length === 0 ? (
              <p className="text-sm text-slate-500">No change requests for this product yet.</p>
            ) : (
              node.items.map((c) => (
                <Link key={c.id} to={`/changes/${c.id}`} className="block rounded border border-slate-200 bg-white p-3 hover:border-primary">
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
                <p className="text-sm text-slate-500">No release requests for this product.</p>
                <button
                  type="button"
                  onClick={() => navigate(`/releases?fromItemId=${encodeURIComponent(itemId)}&fromItemName=${encodeURIComponent(data.item.name)}&fromItemCode=${encodeURIComponent(data.item.itemCode)}`)}
                  className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white"
                >
                  Create Release Request
                </button>
              </div>
            ) : (
              node.items.map((r) => (
                <Link key={r.id} to={`/releases/${r.id}`} className="block rounded border border-slate-200 bg-white p-3 hover:border-primary">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-500">{r.rrNumber}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-slate-700">{r.title}</p>
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

export function ItemThreadPage(): JSX.Element {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const itemId = String(params.id ?? "");
  const nodeParam = searchParams.get("node") as NodeKey | null;
  const [selectedNode, setSelectedNode] = useState<NodeKey | null>(nodeParam);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

  const thread = useQuery({
    queryKey: ["item-product-thread", itemId],
    queryFn: async () => (await api.get<ProductThreadResponse>(`/items/${itemId}/product-thread`)).data,
    enabled: Boolean(itemId)
  });

  // The canvas div only enters the DOM after the loading-spinner early-return is gone,
  // so re-run the measurement whenever data availability changes (not just on mount).
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
        <p className="text-slate-500">Loading product thread...</p>
      </div>
    );
  }

  if (thread.error || !thread.data) {
    const msg = (thread.error as Error)?.message ?? "Failed to load";
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <p className="text-red-600">{msg}</p>
        <Link to={`/items/${itemId}`} className="text-sm text-primary underline">
          Back to item
        </Link>
      </div>
    );
  }

  const { item, overallCompleteness, actionItems, nodes } = thread.data;

  // Hub-and-spoke geometry
  const cx = canvasSize.w / 2;
  const cy = canvasSize.h / 2;
  const radius = Math.min(cx, cy) * 0.65;
  const NODE_KEYS: NodeKey[] = ["formula", "fgStructure", "artwork", "documents", "specifications", "changes", "releases"];
  const angleStep = (2 * Math.PI) / NODE_KEYS.length;
  const startAngle = -Math.PI / 2; // top

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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            to={`/items/${itemId}`}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            ← Back to item
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/70">Digital Thread</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-slate-400">{item.itemCode}</span>
              <span className="text-slate-300">·</span>
              <h1 className="text-lg font-semibold text-slate-800">{item.name}</h1>
            </div>
          </div>
          <StatusBadge status={item.status} />
        </div>

        <div className="flex items-center gap-4">
          {/* Overall completeness display */}
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
          {canvasSize.w === 0 && <div className="absolute inset-0 flex items-center justify-center"><p className="text-sm text-slate-400">Initialising…</p></div>}
          {canvasSize.w > 0 && (<>
          {/* SVG lines */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            <defs>
              <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="3" refY="2" orient="auto">
                <polygon points="0 0, 6 2, 0 4" fill="#cbd5e1" />
              </marker>
            </defs>
            {nodePositions.map(({ key, x, y }) => {
              const node = nodes[key as keyof typeof nodes];
              const comp = "completeness" in node ? node.completeness : 0;
              const max = "maxScore" in node ? node.maxScore : 1;
              const count = "count" in node ? node.count : ("openCount" in node ? node.openCount : ("items" in node ? node.items.length : 0));
              const pct = max > 0 ? (comp / max) * 100 : (count > 0 ? 60 : 0);
              const color = count === 0 && key !== "changes" ? "#cbd5e1" : completenessColor(pct);
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
                  strokeDasharray={count === 0 && key !== "changes" ? "6 4" : undefined}
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
              <span className="font-mono text-[10px] font-medium text-slate-400">{item.itemCode}</span>
              <span className="line-clamp-2 text-xs font-bold leading-tight text-slate-700">{item.name}</span>
              <span className={`text-sm font-bold ${completenessText(overallCompleteness)}`}>{overallCompleteness}%</span>
            </div>
          </div>

          {/* Spoke nodes */}
          {nodePositions.map(({ key, x, y }) => {
            if (key === "changes") {
              return (
                <div
                  key={key}
                  className="absolute"
                  style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
                >
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
                <div
                  key={key}
                  className="absolute"
                  style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
                >
                  <ReleasesNode
                    latestStatus={nodes.releases.latestStatus}
                    itemCount={nodes.releases.items.length}
                    isSelected={selectedNode === key}
                    onClick={() => handleNodeClick(key)}
                  />
                </div>
              );
            }
            const node = nodes[key as keyof Omit<typeof nodes, "changes" | "releases">] as {
              count: number;
              completeness: number;
              maxScore: number;
              issues: string[];
            };
            return (
              <div
                key={key}
                className="absolute"
                style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
              >
                <SpokeNode
                  nodeKey={key}
                  count={node.count}
                  completeness={node.completeness}
                  maxScore={node.maxScore}
                  issues={node.issues}
                  isSelected={selectedNode === key}
                  onClick={() => handleNodeClick(key)}
                  itemId={itemId}
                />
              </div>
            );
          })}
          </>)}
        </div>

        {/* Right detail panel */}
        {selectedNode !== null && (
          <DetailPanel
            selectedNode={selectedNode}
            data={thread.data}
            onClose={() => setSelectedNode(null)}
            itemId={itemId}
          />
        )}
      </div>

      {/* Action items footer */}
      {actionItems.length > 0 && (
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Action Items</p>
          <div className="flex flex-wrap gap-2">
            {actionItems.map((action, i) => {
              const bg = action.severity === "HIGH" ? "bg-red-50 text-red-700 border-red-200" : action.severity === "MEDIUM" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-600 border-slate-200";
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
