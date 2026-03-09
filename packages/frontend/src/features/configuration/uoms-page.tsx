import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FloatingInput } from "@/components/floating-field";
import { STANDARD_UOMS } from "@/lib/uom";

interface UomDefinition {
  value: string;
  label: string;
  category: string;
}

interface UomResponse {
  data: UomDefinition[];
}

export function ConfigurationUomsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const uomsQuery = useQuery({
    queryKey: ["config-uoms"],
    queryFn: async () => (await api.get<UomResponse>("/config/uoms")).data
  });
  const [form, setForm] = useState({ value: "", label: "", category: "" });

  const uoms = useMemo(() => uomsQuery.data?.data ?? STANDARD_UOMS, [uomsQuery.data?.data]);

  const updateUoms = useMutation({
    mutationFn: async (nextUoms: UomDefinition[]) => {
      await api.put("/config/uoms", nextUoms);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["config-uoms"] });
      setForm({ value: "", label: "", category: "" });
    }
  });

  if (uomsQuery.isLoading) {
    return <div className="rounded-xl bg-white p-4">Loading units of measure...</div>;
  }

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div>
        <p className="text-xs uppercase text-slate-500">Configuration</p>
        <h2 className="font-heading text-xl">Units of Measure</h2>
        <p className="text-sm text-slate-500">Standardize UOMs available across items, formulas, and BOMs.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 font-heading text-lg">Add UOM</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <FloatingInput label="Value" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} />
          <FloatingInput label="Label" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} />
          <FloatingInput label="Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
        </div>
        <button
          type="button"
          onClick={() => updateUoms.mutate([...uoms, form].filter((entry) => entry.value && entry.label && entry.category))}
          disabled={!form.value || !form.label || !form.category || updateUoms.isPending}
          className="mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {updateUoms.isPending ? "Saving..." : "Add UOM"}
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 font-heading text-lg">Configured UOMs</h3>
        <div className="grid gap-2 md:grid-cols-2">
          {uoms.map((uom) => (
            <div key={uom.value} className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-slate-700">{uom.label}</p>
                <p className="text-xs text-slate-500">
                  {uom.value} · {uom.category}
                </p>
              </div>
              <button
                type="button"
                onClick={() => updateUoms.mutate(uoms.filter((entry) => entry.value !== uom.value))}
                className="text-xs text-danger"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
