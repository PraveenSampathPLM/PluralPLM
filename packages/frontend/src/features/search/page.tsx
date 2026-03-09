import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useContainerStore } from "@/store/container.store";
import {
  Package as ItemIcon,
  Beaker as FormulaIcon,
  Layers as BomIcon,
  FileText as DocIcon,
  GitCompare as ChangeIcon,
  Rocket as ReleaseIcon
} from "lucide-react";
import { EntityIcon } from "@/components/entity-icon";

interface SearchResultRow {
  id: string;
  code: string;
  name: string;
  type?: string;
  status?: string;
  extra?: string;
}

type AttributeType = "text" | "number" | "boolean";

interface AttributeDefinition {
  key: string;
  label: string;
  type: AttributeType;
}

interface ConfigResponse {
  attributeDefinitions: { ITEM: AttributeDefinition[] };
}

const entityConfigs = [
  {
    key: "items",
    label: "Materials",
    icon: ItemIcon,
    endpoint: "/items",
    to: (row: SearchResultRow) => `/items/${row.id}`,
    map: (row: any): SearchResultRow => ({
      id: row.id,
      code: row.itemCode,
      name: row.name,
      type: row.itemType,
      status: row.status
    })
  },
  {
    key: "formulas",
    label: "Formulations",
    icon: FormulaIcon,
    endpoint: "/formulas",
    to: (row: SearchResultRow) => `/formulas/${row.id}`,
    map: (row: any): SearchResultRow => ({
      id: row.id,
      code: row.formulaCode,
      name: row.name,
      type: row.recipeType,
      status: row.status
    })
  },
  {
    key: "bom",
    label: "BOMs",
    icon: BomIcon,
    endpoint: "/bom",
    to: (row: SearchResultRow) => `/bom/${row.id}`,
    map: (row: any): SearchResultRow => ({
      id: row.id,
      code: row.bomCode ?? row.code ?? "BOM",
      name: row.parentItem?.name ?? row.name ?? "",
      type: row.type,
      status: row.state ?? row.status
    })
  },
  {
    key: "documents",
    label: "Documents",
    icon: DocIcon,
    endpoint: "/documents",
    to: (row: SearchResultRow) => `/documents/${row.id}`,
    map: (row: any): SearchResultRow => ({
      id: row.id,
      code: row.documentNumber,
      name: row.title ?? row.name,
      type: row.classification,
      status: row.status
    })
  },
  {
    key: "changes",
    label: "Change Requests",
    icon: ChangeIcon,
    endpoint: "/changes",
    to: (row: SearchResultRow) => `/changes/${row.id}`,
    map: (row: any): SearchResultRow => ({
      id: row.id,
      code: row.crNumber,
      name: row.title,
      type: row.type,
      status: row.status
    })
  },
  {
    key: "releases",
    label: "Release Requests",
    icon: ReleaseIcon,
    endpoint: "/releases",
    to: (row: SearchResultRow) => `/releases/${row.id}`,
    map: (row: any): SearchResultRow => ({
      id: row.id,
      code: row.rrNumber ?? row.releaseNumber ?? row.code,
      name: row.title ?? "Release",
      type: row.type,
      status: row.status
    })
  }
] as const;

type EntityKey = (typeof entityConfigs)[number]["key"];

type AttrOp = "contains" | "equals" | "gt" | "gte" | "lt" | "lte";

interface AttributeRow {
  key: string;
  op: AttrOp;
  value: string;
  type: AttributeType;
}

export function AdvancedSearchPage(): JSX.Element {
  const { selectedContainerId } = useContainerStore();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState<EntityKey[]>(entityConfigs.map((c) => c.key));
  const [attrRows, setAttrRows] = useState<AttributeRow[]>([]);
  const [attrBoolean, setAttrBoolean] = useState<"AND" | "OR">("AND");

  const config = useQuery({
    queryKey: ["search-attributes"],
    queryFn: async () => (await api.get<ConfigResponse>("/config")).data
  });
  const attrOptions = config.data?.attributeDefinitions?.ITEM ?? [];

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(id);
  }, [query]);

  const attributePayload = attrRows
    .filter((row) => row.key && row.value !== "")
    .map((row) => ({ key: row.key, op: row.op, value: row.value, type: row.type }));

  const queries = useQueries({
    queries: entityConfigs.map((config) => ({
      queryKey: ["search", config.key, debounced, selectedContainerId, attributePayload, attrBoolean],
      queryFn: async () => {
        const res = await api.get<{ data: any[] }>(config.endpoint, {
          params: {
            search: debounced,
            pageSize: 15,
            ...(selectedContainerId ? { containerId: selectedContainerId } : {}),
            ...(config.key === "items" && attributePayload.length
              ? {
                  attributeFilters: JSON.stringify(attributePayload),
                  attributeBoolean: attrBoolean
                }
              : {})
          }
        });
        return res.data.data.map(config.map);
      },
      enabled: Boolean(debounced) && active.includes(config.key)
    }))
  });

  const isLoading = queries.some((q) => q.isLoading);
  const anyActive = active.length > 0;

  const results = useMemo(() => {
    const map: Record<EntityKey, SearchResultRow[]> = {
      items: [],
      formulas: [],
      bom: [],
      documents: [],
      changes: [],
      releases: []
    };
    queries.forEach((q, idx) => {
      const key = entityConfigs[idx].key;
      if (q.data) {
        map[key as EntityKey] = q.data as SearchResultRow[];
      }
    });
    return map;
  }, [queries]);

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Advanced Search</p>
        <h1 className="mt-2 font-heading text-2xl font-semibold text-slate-900">Search across Plural PLM</h1>
        <p className="mt-2 text-sm text-slate-600">
          Search materials, formulations, BOMs, documents, and lifecycle records with one query. Results are scoped to
          your selected container.
        </p>
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by code, name, or description..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            {entityConfigs.map((config) => {
              const checked = active.includes(config.key);
              return (
                <button
                  key={config.key}
                  type="button"
                  onClick={() =>
                    setActive((prev) =>
                      checked ? prev.filter((k) => k !== config.key) : [...prev, config.key as EntityKey]
                    )
                  }
                  className={`rounded-full border px-3 py-1 text-xs ${
                    checked ? "border-primary bg-primary/10 text-primary" : "border-slate-300 text-slate-600"
                  }`}
                >
                  {config.label}
                </button>
              );
            })}
          </div>
        </div>
        {active.includes("items") ? (
          <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Attribute Filters (Materials)</p>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>Match</span>
                <select
                  value={attrBoolean}
                  onChange={(e) => setAttrBoolean(e.target.value === "OR" ? "OR" : "AND")}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                >
                  <option value="AND">All (AND)</option>
                  <option value="OR">Any (OR)</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              {attrRows.map((row, idx) => {
                const selected = attrOptions.find((opt) => opt.key === row.key);
                const type: AttributeType = selected?.type ?? row.type;
                return (
                  <div key={idx} className="flex flex-wrap items-center gap-2">
                    <select
                      value={row.key}
                      onChange={(e) => {
                        const key = e.target.value;
                        const def = attrOptions.find((opt) => opt.key === key);
                        setAttrRows((prev) =>
                          prev.map((r, i) =>
                            i === idx
                              ? { ...r, key, type: def?.type ?? r.type, op: def?.type === "number" ? "equals" : r.op, value: "" }
                              : r
                          )
                        );
                      }}
                      className="min-w-[160px] rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    >
                      <option value="">Attribute…</option>
                      {attrOptions.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={row.op}
                      onChange={(e) =>
                        setAttrRows((prev) => prev.map((r, i) => (i === idx ? { ...r, op: e.target.value as AttrOp } : r)))
                      }
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    >
                      {type === "text" ? (
                        <>
                          <option value="contains">contains</option>
                          <option value="equals">equals</option>
                        </>
                      ) : type === "number" ? (
                        <>
                          <option value="equals">equals</option>
                          <option value="gt">&gt;</option>
                          <option value="gte">≥</option>
                          <option value="lt">&lt;</option>
                          <option value="lte">≤</option>
                        </>
                      ) : (
                        <option value="equals">is</option>
                      )}
                    </select>
                    {type === "boolean" ? (
                      <select
                        value={row.value}
                        onChange={(e) =>
                          setAttrRows((prev) => prev.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)))
                        }
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        <option value="">Select</option>
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    ) : (
                      <input
                        value={row.value}
                        onChange={(e) =>
                          setAttrRows((prev) => prev.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)))
                        }
                        placeholder={type === "number" ? "Value" : "Text"}
                        className="min-w-[140px] rounded border border-slate-300 px-2 py-1 text-xs"
                        type={type === "number" ? "number" : "text"}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setAttrRows((prev) => prev.filter((_, i) => i !== idx))}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      −
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setAttrRows((prev) => [
                    ...prev,
                    { key: "", op: "contains", value: "", type: "text" as AttributeType }
                  ])
                }
                className="rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                + Add attribute filter
              </button>
              {attributePayload.length ? (
                <span className="text-xs text-slate-500">{attributePayload.length} applied</span>
              ) : null}
            </div>
          </div>
        ) : null}
        {!anyActive ? (
          <p className="mt-2 text-xs text-red-600">Select at least one entity to search.</p>
        ) : null}
      </header>

      {debounced ? (
        <div className="space-y-4">
          {entityConfigs.map((config, idx) => {
            if (!active.includes(config.key)) return null;
            const queryResult = queries[idx];
            const rows = results[config.key];
            return (
              <section key={config.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{config.label}</p>
                    <p className="text-sm text-slate-600">{rows.length} result(s)</p>
                  </div>
                  {queryResult.isFetching ? <p className="text-xs text-slate-500">Loading…</p> : null}
                </div>
                {isLoading && !rows.length ? (
                  <div className="mt-3 h-16 animate-pulse rounded-lg bg-slate-100" />
                ) : rows.length ? (
                  <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="w-10 px-3 py-2 text-left"> </th>
                          <th className="px-3 py-2 text-left">Code</th>
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-left">Type</th>
                          <th className="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-500">
                              {config.key === "items" ? (
                                <EntityIcon kind="item" variant={row.type} />
                              ) : (
                                <config.icon size={16} strokeWidth={1.75} />
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-primary">
                              <Link to={config.to(row)}>{row.code}</Link>
                            </td>
                            <td className="px-3 py-2 text-slate-800">
                              <Link to={config.to(row)} className="hover:underline">
                                {row.name}
                              </Link>
                            </td>
                            <td className="px-3 py-2 text-slate-600">{row.type ?? "—"}</td>
                            <td className="px-3 py-2 text-slate-600">{row.status ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No results.</p>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
          Enter a query to see results across all selected modules.
        </div>
      )}
    </div>
  );
}
