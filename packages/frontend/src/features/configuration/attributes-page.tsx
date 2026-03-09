import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FloatingInput, FloatingSelect } from "@/components/floating-field";

type AttributeEntity = "ITEM";

interface AppConfig {
  attributeDefinitions: {
    ITEM: Array<{ key: string; label: string; type: "text" | "number" | "boolean"; required: boolean }>;
  };
}

export function ConfigurationAttributesPage(): JSX.Element {
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: ["app-config-attributes"],
    queryFn: async () => (await api.get<AppConfig>("/config")).data
  });

  const [attributeForm, setAttributeForm] = useState({
    entity: "ITEM" as AttributeEntity,
    key: "",
    label: "",
    type: "text" as "text" | "number" | "boolean",
    required: false
  });

  const addAttribute = useMutation({
    mutationFn: async () => {
      await api.post("/config/attributes", attributeForm);
    },
    onSuccess: async () => {
      setAttributeForm({ entity: "ITEM", key: "", label: "", type: "text", required: false });
      await queryClient.invalidateQueries({ queryKey: ["app-config-attributes"] });
    }
  });

  const removeAttribute = useMutation({
    mutationFn: async (input: { entity: AttributeEntity; key: string }) => {
      await api.delete(`/config/attributes/${input.entity}/${input.key}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["app-config-attributes"] });
    }
  });

  const config = configQuery.data;

  if (configQuery.isLoading) {
    return <div className="rounded-xl bg-white p-4">Loading attribute definitions...</div>;
  }

  if (!config) {
    return <div className="rounded-xl bg-white p-4">Configuration not available.</div>;
  }

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div>
        <p className="text-xs uppercase text-slate-500">Configuration</p>
        <h2 className="font-heading text-xl">Custom Attributes</h2>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 font-heading text-lg">Add Attribute</h3>
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
        <button
          type="button"
          onClick={() => addAttribute.mutate()}
          disabled={!attributeForm.key || !attributeForm.label || addAttribute.isPending}
          className="mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {addAttribute.isPending ? "Adding..." : "Add Attribute"}
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 font-heading text-lg">Defined Attributes</h3>
        <div className="space-y-2">
          {(config?.attributeDefinitions?.ITEM ?? []).map((attribute) => (
            <div key={attribute.key} className="flex items-center justify-between rounded border border-slate-100 bg-white px-3 py-2 text-sm">
              <span>
                {attribute.label} ({attribute.key}) [{attribute.type}] {attribute.required ? "*" : ""}
              </span>
              <button type="button" onClick={() => removeAttribute.mutate({ entity: "ITEM", key: attribute.key })} className="text-xs text-danger">
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
