import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FloatingInput, FloatingSelect } from "@/components/floating-field";

type ConfigEntity = "ITEM" | "ITEM_FINISHED_GOOD" | "ITEM_PACKAGING" | "FORMULA" | "BOM" | "CHANGE_REQUEST" | "DOCUMENT";
type RevisionEntity = "ITEM" | "FORMULA" | "BOM";
type ListEntity = "ITEM" | "FORMULA" | "BOM" | "CHANGE_REQUEST" | "SPECIFICATION";

type AttributeEntity = "ITEM";

interface AppConfig {
  numberSequences: Record<ConfigEntity, { prefix: string; padding: number; next: number }>;
  revisionSchemes: Record<RevisionEntity, { style: "NUMERIC" | "ALPHA_NUMERIC"; delimiter: string }>;
  listColumns: Record<ListEntity, string[]>;
  attributeDefinitions: {
    ITEM: Array<{ key: string; label: string; type: "text" | "number" | "boolean"; required: boolean }>;
  };
}

const sequenceLabels: Record<ConfigEntity, string> = {
  ITEM: "Raw Material / Intermediate",
  ITEM_FINISHED_GOOD: "Finished Good",
  ITEM_PACKAGING: "Packaging",
  FORMULA: "Formula",
  BOM: "BOM",
  CHANGE_REQUEST: "Change Request",
  DOCUMENT: "Document"
};

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

export function ConfigurationPage(): JSX.Element {
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: ["app-config"],
    queryFn: async () => (await api.get<AppConfig>("/config")).data
  });

  const [attributeForm, setAttributeForm] = useState({
    entity: "ITEM" as AttributeEntity,
    key: "",
    label: "",
    type: "text" as "text" | "number" | "boolean",
    required: false
  });
  const [columnDrafts, setColumnDrafts] = useState<Partial<Record<ListEntity, string[]>>>({});

  const updateSequence = useMutation({
    mutationFn: async (input: { entity: ConfigEntity; prefix: string; padding: number; next: number }) => {
      await api.put(`/config/number-sequences/${input.entity}`, {
        prefix: input.prefix,
        padding: input.padding,
        next: input.next
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["app-config"] });
    }
  });

  const updateRevision = useMutation({
    mutationFn: async (input: {
      entity: RevisionEntity;
      style: "NUMERIC" | "ALPHA_NUMERIC";
      delimiter: string;
    }) => {
      await api.put(`/config/revision-schemes/${input.entity}`, {
        style: input.style,
        delimiter: input.delimiter
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["app-config"] });
    }
  });

  const updateListColumns = useMutation({
    mutationFn: async (input: { entity: ListEntity; columns: string[] }) => {
      await api.put(`/config/list-columns/${input.entity}`, { columns: input.columns });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["app-config"] });
    }
  });

  const addAttribute = useMutation({
    mutationFn: async () => {
      await api.post("/config/attributes", attributeForm);
    },
    onSuccess: async () => {
      setAttributeForm({ entity: "ITEM", key: "", label: "", type: "text", required: false });
      await queryClient.invalidateQueries({ queryKey: ["app-config"] });
    }
  });

  const removeAttribute = useMutation({
    mutationFn: async (input: { entity: AttributeEntity; key: string }) => {
      await api.delete(`/config/attributes/${input.entity}/${input.key}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["app-config"] });
    }
  });

  const config = configQuery.data;

  if (configQuery.isLoading) {
    return <div className="rounded-xl bg-white p-4">Loading configuration...</div>;
  }

  if (!config) {
    return <div className="rounded-xl bg-white p-4">Configuration not available.</div>;
  }

  return (
    <div className="space-y-6 rounded-xl bg-white p-4">
      <h2 className="font-heading text-xl">Configuration</h2>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 font-heading text-lg">Smart Numbering</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {(Object.keys(config?.numberSequences ?? {}) as ConfigEntity[]).map((entity) => {
            const sequence = config?.numberSequences[entity];
            if (!sequence) {
              return null;
            }

            return (
              <div key={entity} className="rounded border border-slate-200 bg-white p-3">
                <p className="mb-1 text-sm font-medium text-slate-700">{sequenceLabels[entity]}</p>
                <p className="mb-2 text-xs text-slate-500">{entity}</p>
                <div className="grid gap-2">
                  <FloatingInput
                    label="Prefix"
                    defaultValue={sequence.prefix}
                    onBlur={(event) =>
                      updateSequence.mutate({ entity, prefix: event.target.value, padding: sequence.padding, next: sequence.next })
                    }
                  />
                  <FloatingInput
                    type="number"
                    label="Padding"
                    defaultValue={sequence.padding}
                    onBlur={(event) =>
                      updateSequence.mutate({ entity, prefix: sequence.prefix, padding: Number(event.target.value), next: sequence.next })
                    }
                  />
                  <FloatingInput
                    type="number"
                    label="Next Number"
                    defaultValue={sequence.next}
                    onBlur={(event) =>
                      updateSequence.mutate({ entity, prefix: sequence.prefix, padding: sequence.padding, next: Number(event.target.value) })
                    }
                  />
                  <p className="text-xs text-slate-500">Next Preview: {sequence.prefix}{String(sequence.next).padStart(sequence.padding, "0")}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 font-heading text-lg">Revision Scheme</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {(Object.keys(config?.revisionSchemes ?? {}) as RevisionEntity[]).map((entity) => {
            const scheme = config?.revisionSchemes[entity];
            if (!scheme) {
              return null;
            }

            return (
              <div key={entity} className="rounded border border-slate-200 bg-white p-3">
                <p className="mb-2 text-sm font-medium text-slate-700">{entity}</p>
                <FloatingSelect
                  label="Revision Style"
                  value={scheme.style}
                  onChange={(event) =>
                    updateRevision.mutate({
                      entity,
                      style: event.target.value as "NUMERIC" | "ALPHA_NUMERIC",
                      delimiter: scheme.delimiter
                    })
                  }
                >
                  <option value="NUMERIC">Numeric (1.1, 2.1)</option>
                  <option value="ALPHA_NUMERIC">Alpha Numeric (A.1, B.1)</option>
                </FloatingSelect>
                <FloatingInput
                  label="Delimiter"
                  defaultValue={scheme.delimiter}
                  onBlur={(event) =>
                    updateRevision.mutate({
                      entity,
                      style: scheme.style,
                      delimiter: event.target.value || "."
                    })
                  }
                />
                <p className="mt-2 text-xs text-slate-500">
                  Example: {scheme.style === "ALPHA_NUMERIC" ? `A${scheme.delimiter}1` : `1${scheme.delimiter}1`}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 font-heading text-lg">List Columns</h3>
        <div className="space-y-3">
          {(Object.keys(config?.listColumns ?? {}) as ListEntity[]).map((entity) => {
            const selected = columnDrafts[entity] ?? config?.listColumns[entity] ?? [];
            return (
              <div key={entity} className="rounded border border-slate-200 bg-white p-3">
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
                              const next = event.target.checked
                                ? [...base, option.key]
                                : base.filter((entry) => entry !== option.key);
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

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 font-heading text-lg">Custom Attributes</h3>
        <div className="grid gap-3 md:grid-cols-5">
          <FloatingInput label="Entity" value="ITEM" readOnly />
          <FloatingInput label="Key" value={attributeForm.key} onChange={(event) => setAttributeForm({ ...attributeForm, key: event.target.value })} />
          <FloatingInput label="Label" value={attributeForm.label} onChange={(event) => setAttributeForm({ ...attributeForm, label: event.target.value })} />
          <FloatingSelect label="Type" value={attributeForm.type} onChange={(event) => setAttributeForm({ ...attributeForm, type: event.target.value as "text" | "number" | "boolean" })}>
            <option value="text">text</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
          </FloatingSelect>
          <label className="flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm">
            <input type="checkbox" checked={attributeForm.required} onChange={(event) => setAttributeForm({ ...attributeForm, required: event.target.checked })} />
            Required
          </label>
        </div>
        <button type="button" onClick={() => addAttribute.mutate()} disabled={!attributeForm.key || !attributeForm.label || addAttribute.isPending} className="mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {addAttribute.isPending ? "Adding..." : "Add Attribute"}
        </button>

        <div className="mt-4 rounded border border-slate-200 bg-white p-3">
          <p className="mb-2 text-sm font-medium">ITEM</p>
          <div className="space-y-2">
            {(config?.attributeDefinitions?.ITEM ?? []).map((attribute) => (
              <div key={attribute.key} className="flex items-center justify-between rounded border border-slate-100 px-2 py-1 text-sm">
                <span>{attribute.label} ({attribute.key}) [{attribute.type}] {attribute.required ? "*" : ""}</span>
                <button type="button" onClick={() => removeAttribute.mutate({ entity: "ITEM", key: attribute.key })} className="text-xs text-danger">Remove</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
