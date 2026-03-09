import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FloatingSelect, FloatingInput } from "@/components/floating-field";

type RevisionEntity = "ITEM" | "FORMULA" | "BOM";

interface AppConfig {
  revisionSchemes: Record<RevisionEntity, { style: "NUMERIC" | "ALPHA_NUMERIC"; delimiter: string }>;
}

export function ConfigurationRevisionsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: ["app-config-revisions"],
    queryFn: async () => (await api.get<AppConfig>("/config")).data
  });

  const updateRevision = useMutation({
    mutationFn: async (input: { entity: RevisionEntity; style: "NUMERIC" | "ALPHA_NUMERIC"; delimiter: string }) => {
      await api.put(`/config/revision-schemes/${input.entity}`, {
        style: input.style,
        delimiter: input.delimiter
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["app-config-revisions"] });
    }
  });

  const config = configQuery.data;

  if (configQuery.isLoading) {
    return <div className="rounded-xl bg-white p-4">Loading revision schemes...</div>;
  }

  if (!config) {
    return <div className="rounded-xl bg-white p-4">Configuration not available.</div>;
  }

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div>
        <p className="text-xs uppercase text-slate-500">Configuration</p>
        <h2 className="font-heading text-xl">Revision Schemes</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {(Object.keys(config?.revisionSchemes ?? {}) as RevisionEntity[]).map((entity) => {
          const scheme = config?.revisionSchemes[entity];
          if (!scheme) {
            return null;
          }

          return (
            <div key={entity} className="rounded border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-sm font-medium text-slate-700">{entity}</p>
              <FloatingSelect
                label="Revision Style"
                defaultValue={scheme.style}
                onChange={(event) => updateRevision.mutate({ entity, style: event.target.value as "NUMERIC" | "ALPHA_NUMERIC", delimiter: scheme.delimiter })}
              >
                <option value="NUMERIC">Numeric (1.1)</option>
                <option value="ALPHA_NUMERIC">Alpha Numeric (A.1)</option>
              </FloatingSelect>
              <div className="mt-2">
                <FloatingInput
                  label="Delimiter"
                  defaultValue={scheme.delimiter}
                  onBlur={(event) => updateRevision.mutate({ entity, style: scheme.style, delimiter: event.target.value || "." })}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Example: {scheme.style === "ALPHA_NUMERIC" ? `A${scheme.delimiter}1` : `1${scheme.delimiter}1`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
