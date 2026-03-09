import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useContainerStore } from "@/store/container.store";
import { Link } from "react-router-dom";

interface FormulaListRow {
  id: string;
  formulaCode: string;
  version: number;
  name: string;
  industryType?: string;
}

interface LabelPreview {
  declaration: string[];
  composition: Array<{ name: string; code: string; percentage: number | null }>;
  allergens: string[];
  nutrition?: Array<{ attribute: string; value: string | null; minValue: number | null; maxValue: number | null; uom: string | null }>;
}

export function LabelingPage(): JSX.Element {
  const { selectedContainerId } = useContainerStore();
  const [search, setSearch] = useState("");
  const [selectedFormulaId, setSelectedFormulaId] = useState("");

  const formulas = useQuery({
    queryKey: ["labeling-formulas", selectedContainerId],
    queryFn: async () =>
      (
        await api.get<{ data: FormulaListRow[] }>("/formulas", {
          params: { pageSize: 200, ...(selectedContainerId ? { containerId: selectedContainerId } : {}) }
        })
      ).data
  });

  const filtered = useMemo(() => {
    const list = formulas.data?.data ?? [];
    if (!search.trim()) {
      return list;
    }
    const term = search.trim().toLowerCase();
    return list.filter((entry) => `${entry.formulaCode} ${entry.name}`.toLowerCase().includes(term));
  }, [formulas.data?.data, search]);

  const selectedFormula = filtered.find((entry) => entry.id === selectedFormulaId) ?? filtered[0];

  useEffect(() => {
    if (!selectedFormulaId && filtered.length) {
      setSelectedFormulaId(filtered[0].id);
    }
  }, [filtered, selectedFormulaId]);

  const labelPreview = useQuery({
    queryKey: ["labeling-preview", selectedFormula?.id],
    queryFn: async () => (await api.get<LabelPreview>(`/labels/formulas/${selectedFormula?.id}`)).data,
    enabled: Boolean(selectedFormula?.id)
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3">
          <p className="text-xs uppercase text-slate-500">Labeling</p>
          <h2 className="font-heading text-xl">Formula Labeling</h2>
          <p className="text-xs text-slate-500">Select a formulation to generate label-ready content.</p>
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search formulations..."
          className="mb-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="space-y-2">
          {filtered.length === 0 ? <p className="text-xs text-slate-500">No formulations found.</p> : null}
          {filtered.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSelectedFormulaId(entry.id)}
              className={`w-full rounded border px-3 py-2 text-left text-xs ${
                selectedFormula?.id === entry.id ? "border-primary bg-blue-50" : "border-slate-200 bg-white"
              }`}
            >
              <div className="font-mono text-[11px] text-slate-500">{entry.formulaCode} v{entry.version}</div>
              <div className="font-medium text-slate-800">{entry.name}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-slate-500">Label Preview</p>
              <h3 className="font-heading text-lg">{selectedFormula ? selectedFormula.name : "Select a formula"}</h3>
            </div>
            {selectedFormula ? (
              <Link to={`/formulas/${selectedFormula.id}`} className="text-xs text-primary hover:underline">
                Open formulation
              </Link>
            ) : null}
          </div>
          {labelPreview.isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading label preview...</p>
          ) : labelPreview.data ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                <h4 className="mb-2 font-medium text-slate-700">Ingredient Declaration</h4>
                {labelPreview.data.declaration?.length ? (
                  <ol className="list-decimal space-y-1 pl-4 text-slate-700">
                    {labelPreview.data.declaration.map((line, index) => (
                      <li key={`${line}-${index}`}>{line}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-slate-500">No declaration available.</p>
                )}
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                <h4 className="mb-2 font-medium text-slate-700">Allergens</h4>
                {labelPreview.data.allergens?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {labelPreview.data.allergens.map((allergen) => (
                      <span key={allergen} className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">
                        {allergen}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">No allergens detected.</p>
                )}
              </div>
              <div className="md:col-span-2 rounded border border-slate-200 bg-white p-3 text-sm">
                <h4 className="mb-3 font-medium text-slate-700">Composition</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Code</th>
                        <th className="px-3 py-2">Ingredient</th>
                        <th className="px-3 py-2 text-right">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(labelPreview.data.composition ?? []).map((row, index) => (
                        <tr key={`${row.code}-${index}`} className="border-b border-slate-100">
                          <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.code || "—"}</td>
                          <td className="px-3 py-2">{row.name}</td>
                          <td className="px-3 py-2 text-right">
                            {typeof row.percentage === "number" ? row.percentage.toFixed(2) : "—"}
                          </td>
                        </tr>
                      ))}
                      {labelPreview.data.composition?.length ? null : (
                        <tr>
                          <td colSpan={3} className="px-3 py-3 text-center text-slate-500">
                            No composition data available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="md:col-span-2 rounded border border-slate-200 bg-white p-3 text-sm">
                <h4 className="mb-3 font-medium text-slate-700">Nutrition Panel</h4>
                {labelPreview.data.nutrition?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-3 py-2">Nutrient</th>
                          <th className="px-3 py-2">Value</th>
                          <th className="px-3 py-2">Min</th>
                          <th className="px-3 py-2">Max</th>
                          <th className="px-3 py-2">UOM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {labelPreview.data.nutrition.map((row) => (
                          <tr key={row.attribute} className="border-b border-slate-100">
                            <td className="px-3 py-2 font-medium text-slate-700">{row.attribute}</td>
                            <td className="px-3 py-2">{row.value ?? "—"}</td>
                            <td className="px-3 py-2">{row.minValue ?? "—"}</td>
                            <td className="px-3 py-2">{row.maxValue ?? "—"}</td>
                            <td className="px-3 py-2">{row.uom ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500">No nutrition specs configured for this formula.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Select a formulation to preview its label.</p>
          )}
        </div>
      </div>
    </div>
  );
}
