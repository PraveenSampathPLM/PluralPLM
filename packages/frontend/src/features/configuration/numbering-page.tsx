import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FloatingInput } from "@/components/floating-field";

type ConfigEntity = "ITEM" | "ITEM_FINISHED_GOOD" | "ITEM_PACKAGING" | "FORMULA" | "BOM" | "CHANGE_REQUEST" | "DOCUMENT";

interface AppConfig {
  numberSequences: Record<ConfigEntity, { prefix: string; padding: number; next: number }>;
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

export function ConfigurationNumberingPage(): JSX.Element {
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: ["app-config-numbering"],
    queryFn: async () => (await api.get<AppConfig>("/config")).data
  });

  const updateSequence = useMutation({
    mutationFn: async (input: { entity: ConfigEntity; prefix: string; padding: number; next: number }) => {
      await api.put(`/config/number-sequences/${input.entity}`, {
        prefix: input.prefix,
        padding: input.padding,
        next: input.next
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["app-config-numbering"] });
    }
  });

  const config = configQuery.data;

  if (configQuery.isLoading) {
    return <div className="rounded-xl bg-white p-4">Loading numbering configuration...</div>;
  }

  if (!config) {
    return <div className="rounded-xl bg-white p-4">Configuration not available.</div>;
  }

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div>
        <p className="text-xs uppercase text-slate-500">Configuration</p>
        <h2 className="font-heading text-xl">Smart Numbering</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(Object.keys(config?.numberSequences ?? {}) as ConfigEntity[]).map((entity) => {
          const sequence = config?.numberSequences[entity];
          if (!sequence) {
            return null;
          }

          return (
            <div key={entity} className="rounded border border-slate-200 bg-slate-50 p-3">
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
                <p className="text-xs text-slate-500">
                  Next Preview: {sequence.prefix}
                  {String(sequence.next).padStart(sequence.padding, "0")}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
