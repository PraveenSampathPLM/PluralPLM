import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

type ListEntity = "ITEM" | "FORMULA" | "BOM" | "CHANGE_REQUEST" | "SPECIFICATION";

interface AppConfig {
  listColumns: Record<ListEntity, string[]>;
}

const columnOptions: Record<ListEntity, Array<{ key: string; label: string }>> = {
  ITEM: [
    { key: "itemCode", label: "Item Code" },
    { key: "revisionLabel", label: "Revision" },
    { key: "name", label: "Name" },
    { key: "itemType", label: "Type" },
    { key: "uom", label: "UOM" },
    { key: "status", label: "Status" },
    { key: "updatedAt", label: "Updated" }
  ],
  FORMULA: [
    { key: "formulaCode", label: "Formula Code" },
    { key: "revisionLabel", label: "Revision" },
    { key: "name", label: "Name" },
    { key: "version", label: "Version" },
    { key: "status", label: "Status" },
    { key: "updatedAt", label: "Updated" }
  ],
  BOM: [
    { key: "bomCode", label: "BOM Code" },
    { key: "revisionLabel", label: "Revision" },
    { key: "type", label: "Type" },
    { key: "version", label: "Version" },
    { key: "effectiveDate", label: "Effective Date" },
    { key: "updatedAt", label: "Updated" }
  ],
  CHANGE_REQUEST: [
    { key: "crNumber", label: "CR Number" },
    { key: "title", label: "Title" },
    { key: "type", label: "Type" },
    { key: "priority", label: "Priority" },
    { key: "status", label: "Status" }
  ],
  SPECIFICATION: [
    { key: "specType", label: "Spec Type" },
    { key: "attribute", label: "Attribute" },
    { key: "value", label: "Value" },
    { key: "minValue", label: "Min" },
    { key: "maxValue", label: "Max" },
    { key: "uom", label: "UOM" },
    { key: "testMethod", label: "Test Method" }
  ]
};

export function ConfigurationColumnsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: ["app-config-columns"],
    queryFn: async () => (await api.get<AppConfig>("/config")).data
  });
  const [columnDrafts, setColumnDrafts] = useState<Partial<Record<ListEntity, string[]>>>({});

  const updateListColumns = useMutation({
    mutationFn: async (input: { entity: ListEntity; columns: string[] }) => {
      await api.put(`/config/list-columns/${input.entity}`, { columns: input.columns });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["app-config-columns"] });
    }
  });

  const config = configQuery.data;

  if (configQuery.isLoading) {
    return <div className="rounded-xl bg-white p-4">Loading list column settings...</div>;
  }

  if (!config) {
    return <div className="rounded-xl bg-white p-4">Configuration not available.</div>;
  }

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div>
        <p className="text-xs uppercase text-slate-500">Configuration</p>
        <h2 className="font-heading text-xl">List Columns</h2>
      </div>
      <div className="space-y-3">
        {(Object.keys(config?.listColumns ?? {}) as ListEntity[]).map((entity) => {
          const selected = columnDrafts[entity] ?? config?.listColumns[entity] ?? [];
          return (
            <div key={entity} className="rounded border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-sm font-medium text-slate-700">{entity}</p>
              <div className="grid gap-2 md:grid-cols-3">
                {(columnOptions[entity] ?? []).map((option) => {
                  const isChecked = selected.includes(option.key);
                  return (
                    <label key={option.key} className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1 text-xs">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(event) => {
                          setColumnDrafts((previous) => {
                            const base = previous[entity] ?? config?.listColumns[entity] ?? [];
                            const next = event.target.checked ? [...base, option.key] : base.filter((entry) => entry !== option.key);
                            return { ...previous, [entity]: next };
                          });
                        }}
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => updateListColumns.mutate({ entity, columns: selected.length ? selected : config?.listColumns[entity] ?? [] })}
                className="mt-2 rounded border border-slate-300 bg-white px-3 py-1 text-xs"
              >
                Save Columns
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
