import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";

export type AffectedObjectType = "ITEM" | "FORMULA" | "DOCUMENT";

export interface AffectedObject {
  type: AffectedObjectType;
  id: string;
  code: string;
  name: string;
  status: string;
  version?: string | undefined;
}

interface SearchResult {
  id: string;
  code: string;
  name: string;
  status: string;
  version?: string | undefined;
}

interface Props {
  value: AffectedObject[];
  onChange: (objects: AffectedObject[]) => void;
  /** If set, warns and blocks objects not in this status */
  requiredStatus?: "RELEASED" | "IN_WORK";
}

const TABS: { type: AffectedObjectType; label: string; emoji: string }[] = [
  { type: "ITEM", label: "Items", emoji: "📦" },
  { type: "FORMULA", label: "Formulas", emoji: "🧪" },
  { type: "DOCUMENT", label: "Documents", emoji: "📄" }
];

function statusColor(status: string): string {
  if (status === "RELEASED") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "IN_WORK" || status === "DRAFT") return "bg-amber-100 text-amber-700 border-amber-200";
  if (status === "OBSOLETE") return "bg-slate-100 text-slate-500 border-slate-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function statusLabel(status: string): string {
  if (status === "IN_WORK") return "In Work";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

export function AffectedObjectsPicker({ value, onChange, requiredStatus }: Props): JSX.Element {
  const [activeTab, setActiveTab] = useState<AffectedObjectType>("ITEM");
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // clear results when switching tabs
  useEffect(() => {
    setSearchText("");
    setResults([]);
  }, [activeTab]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = searchText.trim();
    if (!q) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        if (activeTab === "ITEM") {
          const resp = await api.get<{
            data: Array<{ id: string; itemCode: string; name: string; status: string; revisionLabel: string }>;
          }>("/items", { params: { search: q, pageSize: 20 } });
          setResults(resp.data.data.map((i) => ({ id: i.id, code: i.itemCode, name: i.name, status: i.status, version: i.revisionLabel })));
        } else if (activeTab === "FORMULA") {
          const resp = await api.get<{
            data: Array<{ id: string; formulaCode: string; name: string; status: string; revisionLabel: string }>;
          }>("/formulas", { params: { search: q, pageSize: 20 } });
          setResults(resp.data.data.map((f) => ({ id: f.id, code: f.formulaCode, name: f.name, status: f.status, version: f.revisionLabel })));
        } else {
          const resp = await api.get<{
            data: Array<{ id: string; docNumber: string; name: string; status: string }>;
          }>("/documents", { params: { search: q, pageSize: 20 } });
          setResults(resp.data.data.map((d) => ({ id: d.id, code: d.docNumber, name: d.name, status: d.status })));
        }
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
  }, [searchText, activeTab]);

  function add(result: SearchResult): void {
    if (value.find((v) => v.id === result.id)) return;
    onChange([...value, { type: activeTab, id: result.id, code: result.code, name: result.name, status: result.status, version: result.version }]);
  }

  function remove(id: string): void {
    onChange(value.filter((v) => v.id !== id));
  }

  function statusWarning(obj: AffectedObject): string | null {
    if (!requiredStatus) return null;
    if (requiredStatus === "RELEASED" && obj.status !== "RELEASED")
      return `Change requests require Released objects — this is ${statusLabel(obj.status)}`;
    if (requiredStatus === "IN_WORK" && obj.status !== "IN_WORK" && obj.status !== "DRAFT")
      return `Release requests require In Work objects — this is ${statusLabel(obj.status)}`;
    return null;
  }

  const hasInvalidObjects = value.some((obj) => statusWarning(obj) !== null);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      {/* Tab bar */}
      <div className="flex border-b border-slate-200 bg-slate-50 rounded-t-lg">
        {TABS.map(({ type, label, emoji }) => (
          <button
            key={type}
            type="button"
            onClick={() => setActiveTab(type)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition border-b-2 ${
              activeTab === type
                ? "border-primary text-primary bg-white"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <span>{emoji}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div className="p-3 pb-2">
        <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
          <svg className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={`Search ${activeTab === "ITEM" ? "items" : activeTab === "FORMULA" ? "formulas" : "documents"} by code or name…`}
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400"
          />
          {searching && <span className="text-[10px] text-slate-400 animate-pulse">searching…</span>}
        </div>

        {/* Dropdown results */}
        {results.length > 0 && (
          <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-md">
            {results.map((result) => {
              const added = Boolean(value.find((v) => v.id === result.id));
              const isInvalid =
                requiredStatus &&
                ((requiredStatus === "RELEASED" && result.status !== "RELEASED") ||
                  (requiredStatus === "IN_WORK" && result.status !== "IN_WORK" && result.status !== "DRAFT"));
              return (
                <button
                  key={result.id}
                  type="button"
                  disabled={added}
                  onClick={() => add(result)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-slate-50 disabled:cursor-default ${
                    isInvalid ? "bg-red-50 hover:bg-red-50" : ""
                  }`}
                >
                  <span className="w-28 flex-shrink-0 truncate font-mono text-slate-600">{result.code}</span>
                  {result.version && <span className="flex-shrink-0 text-[10px] text-slate-400">rev {result.version}</span>}
                  <span className="flex-1 truncate text-slate-700">{result.name}</span>
                  <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColor(result.status)}`}>
                    {statusLabel(result.status)}
                  </span>
                  {isInvalid && (
                    <span className="flex-shrink-0 text-[10px] text-red-500" title={`Expected ${requiredStatus === "RELEASED" ? "Released" : "In Work"}`}>
                      ⚠
                    </span>
                  )}
                  {added ? (
                    <span className="flex-shrink-0 text-[10px] font-medium text-emerald-600">✓ Added</span>
                  ) : (
                    <span className="flex-shrink-0 rounded bg-primary px-1.5 py-0.5 text-[10px] text-white">+ Add</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {searchText.trim() && !searching && results.length === 0 && (
          <p className="mt-1 text-center text-xs text-slate-400 py-1">No results for "{searchText}"</p>
        )}
      </div>

      {/* Selected chips */}
      {value.length > 0 && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Selected ({value.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {value.map((obj) => {
              const warning = statusWarning(obj);
              return (
                <div
                  key={obj.id}
                  title={warning ?? undefined}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                    warning
                      ? "border-red-300 bg-red-50 text-red-700"
                      : "border-slate-200 bg-slate-100 text-slate-700"
                  }`}
                >
                  <span className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase ${
                    obj.type === "ITEM" ? "bg-blue-100 text-blue-600" :
                    obj.type === "FORMULA" ? "bg-purple-100 text-purple-600" :
                    "bg-slate-200 text-slate-600"
                  }`}>
                    {obj.type === "ITEM" ? "ITM" : obj.type === "FORMULA" ? "FML" : "DOC"}
                  </span>
                  <span className="font-mono font-medium">{obj.code}</span>
                  <span className="max-w-[100px] truncate text-slate-500">{obj.name}</span>
                  {warning && <span className="text-red-400" title={warning}>⚠</span>}
                  <button
                    type="button"
                    onClick={() => remove(obj.id)}
                    className="ml-0.5 h-4 w-4 rounded-full text-slate-400 hover:bg-red-100 hover:text-red-500 flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          {/* Global warning banner */}
          {hasInvalidObjects && requiredStatus && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
              <span className="mt-0.5 text-red-500 flex-shrink-0">⚠</span>
              <p className="text-xs text-red-600">
                {requiredStatus === "RELEASED"
                  ? "All affected objects must be in Released status before raising a Change Request. Remove or swap out any non-Released objects."
                  : "All affected objects must be In Work before raising a Release Request. Remove any Released or Obsolete objects."}
              </p>
            </div>
          )}
        </div>
      )}

      {value.length === 0 && (
        <div className="px-3 pb-3 pt-1 text-center text-xs text-slate-400">
          Search above to add affected objects
        </div>
      )}
    </div>
  );
}

/** Returns true if all selected objects satisfy the required status */
export function isPickerValid(value: AffectedObject[], requiredStatus?: "RELEASED" | "IN_WORK"): boolean {
  if (!requiredStatus) return true;
  return value.every((obj) => {
    if (requiredStatus === "RELEASED") return obj.status === "RELEASED";
    if (requiredStatus === "IN_WORK") return obj.status === "IN_WORK" || obj.status === "DRAFT";
    return true;
  });
}
