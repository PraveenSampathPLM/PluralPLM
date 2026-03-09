import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FloatingInput, FloatingSelect } from "@/components/floating-field";

interface SpecTemplate {
  specType: string;
  label: string;
  attributes: Array<{ key: string; defaultUom?: string; defaultTestMethod?: string; valueKind?: "RANGE" | "TEXT" }>;
}

export function SpecificationsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [industry, setIndustry] = useState("CHEMICAL");
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
                      {
                        key: newAttribute.key,
                        defaultUom: newAttribute.defaultUom || undefined,
                        defaultTestMethod: newAttribute.defaultTestMethod || undefined,
                        valueKind: newAttribute.valueKind
                      }
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
    </div>
  );
}
