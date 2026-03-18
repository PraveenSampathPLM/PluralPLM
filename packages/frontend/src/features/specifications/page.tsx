import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { FloatingInput, FloatingSelect } from "@/components/floating-field";

interface SpecTemplate {
  specType: string;
  label: string;
  attributes: Array<{ key: string; defaultUom?: string; defaultTestMethod?: string; valueKind?: "RANGE" | "TEXT" }>;
}

interface SpecRecord {
  id: string;
  specType: string;
  attribute: string;
  value?: string | null;
  uom?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  testMethod?: string | null;
  item?: { id: string; itemCode: string; name: string } | null;
  formula?: { id: string; formulaCode: string; name: string } | null;
  updatedAt: string;
}

export function SpecificationsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [industry, setIndustry] = useState("CHEMICAL");
  const [specSearch, setSpecSearch] = useState("");
  const specRecords = useQuery({
    queryKey: ["spec-records", specSearch],
    queryFn: async () =>
      (await api.get<{ data: SpecRecord[]; total: number }>("/specifications", {
        params: { pageSize: 50, ...(specSearch ? { attribute: specSearch } : {}) }
      })).data
  });
  const templates = useQuery({
    queryKey: ["spec-templates", industry],
    queryFn: async () => (await api.get<{ data: SpecTemplate[] }>(`/specifications/templates/${industry}`)).data
  });
  const [templateDrafts, setTemplateDrafts] = useState<SpecTemplate[]>([]);
  const [newAttribute, setNewAttribute] = useState({
    specType: "",
    key: "",
    defaultUom: "",
    defaultTestMethod: "",
    valueKind: "RANGE" as "RANGE" | "TEXT"
  });

  function toTemplateAttribute(input: {
    key: string;
    defaultUom: string;
    defaultTestMethod: string;
    valueKind: "RANGE" | "TEXT";
  }): SpecTemplate["attributes"][number] {
    const next: SpecTemplate["attributes"][number] = {
      key: input.key,
      valueKind: input.valueKind
    };
    if (input.defaultUom) {
      next.defaultUom = input.defaultUom;
    }
    if (input.defaultTestMethod) {
      next.defaultTestMethod = input.defaultTestMethod;
    }
    return next;
  }

  useEffect(() => {
    if (templates.data?.data?.length) {
      setTemplateDrafts(templates.data.data);
      if (!newAttribute.specType) {
        setNewAttribute((prev) => ({ ...prev, specType: templates.data?.data?.[0]?.specType ?? "" }));
      }
    }
  }, [templates.data?.data]);

  const saveTemplates = useMutation({
    mutationFn: async (nextTemplates: SpecTemplate[]) => {
      await api.put(`/specifications/templates/${industry}`, nextTemplates);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["spec-templates", industry] });
    }
  });

  if (templates.isLoading) {
    return <div className="rounded-xl bg-white p-4">Loading specification templates...</div>;
  }

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div>
        <p className="text-xs uppercase text-slate-500">Configuration</p>
        <h2 className="font-heading text-xl">Specification Templates</h2>
        <p className="text-sm text-slate-500">Add fields here; create specifications from material and formula pages.</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <label className="text-xs font-medium uppercase text-slate-500">Industry</label>
        <select
          value={industry}
          onChange={(event) => setIndustry(event.target.value)}
          className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm md:w-64"
        >
          <option value="FOOD_BEVERAGE">Food & Beverage</option>
          <option value="CHEMICAL">Chemical</option>
          <option value="CPG">CPG</option>
          <option value="PAINT">Paints & Coatings</option>
          <option value="TYRE">Tyre & Rubber</option>
        </select>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 font-heading text-lg">Add Specification Field</h3>
        <div className="grid gap-3 md:grid-cols-5">
          <FloatingSelect
            label="Spec Type"
            value={newAttribute.specType}
            onChange={(event) => setNewAttribute({ ...newAttribute, specType: event.target.value })}
          >
            {templateDrafts.map((template) => (
              <option key={template.specType} value={template.specType}>
                {template.specType}
              </option>
            ))}
          </FloatingSelect>
          <FloatingInput label="Attribute" value={newAttribute.key} onChange={(event) => setNewAttribute({ ...newAttribute, key: event.target.value })} />
          <FloatingInput label="Default UOM" value={newAttribute.defaultUom} onChange={(event) => setNewAttribute({ ...newAttribute, defaultUom: event.target.value })} />
          <FloatingInput
            label="Default Test Method"
            value={newAttribute.defaultTestMethod}
            onChange={(event) => setNewAttribute({ ...newAttribute, defaultTestMethod: event.target.value })}
          />
          <FloatingSelect
            label="Value Kind"
            value={newAttribute.valueKind}
            onChange={(event) => setNewAttribute({ ...newAttribute, valueKind: event.target.value as "RANGE" | "TEXT" })}
          >
            <option value="RANGE">Range</option>
            <option value="TEXT">Text</option>
          </FloatingSelect>
        </div>
        <button
          type="button"
          className="mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          disabled={!newAttribute.specType || !newAttribute.key || saveTemplates.isPending}
          onClick={() => {
	            const nextTemplates = templateDrafts.map((template) =>
	              template.specType === newAttribute.specType
	                ? {
	                    ...template,
	                    attributes: [
	                      ...template.attributes.filter((attr) => attr.key !== newAttribute.key),
	                      toTemplateAttribute(newAttribute)
	                    ]
	                  }
	                : template
	            );
            setTemplateDrafts(nextTemplates);
            saveTemplates.mutate(nextTemplates);
            setNewAttribute({ ...newAttribute, key: "", defaultUom: "", defaultTestMethod: "" });
          }}
        >
          {saveTemplates.isPending ? "Saving..." : "Add Field"}
        </button>
      </div>

      <div className="space-y-3">
        {templateDrafts.map((template) => (
          <div key={template.specType} className="rounded border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2">
              <p className="text-sm font-medium text-slate-800">{template.specType}</p>
              <p className="text-xs text-slate-500">{template.label}</p>
            </div>
            <div className="overflow-hidden rounded border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Attribute</th>
                    <th className="px-3 py-2">Default UOM</th>
                    <th className="px-3 py-2">Default Test Method</th>
                    <th className="px-3 py-2">Value Kind</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {template.attributes.map((attribute) => (
                    <tr key={`${template.specType}-${attribute.key}`} className="border-t border-slate-100">
                      <td className="px-3 py-2">{attribute.key}</td>
                      <td className="px-3 py-2">{attribute.defaultUom ?? "—"}</td>
                      <td className="px-3 py-2">{attribute.defaultTestMethod ?? "—"}</td>
                      <td className="px-3 py-2">{attribute.valueKind ?? "RANGE"}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-xs text-danger"
                          onClick={() => {
                            const nextTemplates = templateDrafts.map((entry) =>
                              entry.specType === template.specType
                                ? { ...entry, attributes: entry.attributes.filter((attr) => attr.key !== attribute.key) }
                                : entry
                            );
                            setTemplateDrafts(nextTemplates);
                            saveTemplates.mutate(nextTemplates);
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* ── Specification Records List ── */}
      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-heading text-lg">Specification Records</h3>
            <p className="text-xs text-slate-500">Click a row to open the specification detail view.</p>
          </div>
          <input
            type="search"
            value={specSearch}
            onChange={(event) => setSpecSearch(event.target.value)}
            placeholder="Search by attribute…"
            className="w-48 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
          />
        </div>
        <div className="overflow-hidden rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Spec Type</th>
                <th className="px-3 py-2">Attribute</th>
                <th className="px-3 py-2">Linked To</th>
                <th className="px-3 py-2">Value / Range</th>
                <th className="px-3 py-2">UOM</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {specRecords.isLoading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-xs text-slate-500">Loading...</td>
                </tr>
              ) : (specRecords.data?.data?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-xs italic text-slate-400">No specification records found.</td>
                </tr>
              ) : (
                specRecords.data?.data.map((rec) => (
                  <tr
                    key={rec.id}
                    onClick={() => navigate(`/specifications/${rec.id}`)}
                    className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-3 py-2">
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-700">
                        {rec.specType}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-700">{rec.attribute}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {rec.item
                        ? `${rec.item.itemCode} — ${rec.item.name}`
                        : rec.formula
                          ? `${rec.formula.formulaCode} — ${rec.formula.name}`
                          : <span className="italic text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {rec.value
                        ? rec.value
                        : rec.minValue !== null && rec.minValue !== undefined
                          ? `${rec.minValue} – ${rec.maxValue ?? "∞"}`
                          : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{rec.uom ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">
                      {new Date(rec.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {(specRecords.data?.total ?? 0) > 50 ? (
          <p className="mt-2 text-xs text-slate-400">
            Showing first 50 of {specRecords.data?.total} records. Use the search to filter.
          </p>
        ) : null}
      </div>
    </div>
  );
}
