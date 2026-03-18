import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useContainerStore } from "@/store/container.store";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { StatusBadge } from "@/components/status-badge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompositionRow {
  name: string;
  code: string;
  percentage: number | null;
}

interface FormulaLabelData {
  declaration: string[];
  composition: CompositionRow[];
  allergens: string[];
  nutrition: Array<{ attribute: string; value: string | null; minValue: number | null; maxValue: number | null; uom: string | null }>;
  outputItem: { id: string; itemCode: string; name: string } | null;
}

interface NutritionalRow {
  energy: string;
  protein: string;
  carbs: string;
  fat: string;
  fibre: string;
  sodium: string;
}

interface LabelTemplateData {
  formulaId?: string;
  productName: string;
  netWeight: string;
  ingredientStatement: string;
  allergenStatement: string;
  nutritionalInfo: { per100g: NutritionalRow; perServing: NutritionalRow } | null;
  regulatoryStatements: string[];
  shelfLife: string;
  storageConditions: string;
  batchFormat: string;
  countryOfOrigin: string;
  manufacturer: string;
}

interface LabelTemplate {
  id: string;
  docNumber: string;
  productName: string;
  formulaId: string | null;
  formula?: { id: string; formulaCode: string; version: number; name: string; status: string } | null;
  status: string;
  containerId: string | null;
  createdAt: string;
  updatedAt: string;
  templateData: LabelTemplateData | null;
}

interface LabelListResponse {
  data: LabelTemplate[];
  total: number;
}

interface FormulaSearchResult {
  id: string;
  formulaCode: string;
  version: number;
  name: string;
  status: string;
}

// ─── Empty template ────────────────────────────────────────────────────────────

function emptyData(): LabelTemplateData {
  return {
    productName: "",
    netWeight: "",
    ingredientStatement: "",
    allergenStatement: "",
    nutritionalInfo: null,
    regulatoryStatements: [],
    shelfLife: "",
    storageConditions: "",
    batchFormat: "",
    countryOfOrigin: "",
    manufacturer: ""
  };
}

function emptyNutritionalRow(): NutritionalRow {
  return { energy: "", protein: "", carbs: "", fat: "", fibre: "", sodium: "" };
}

// ─── Label Preview ─────────────────────────────────────────────────────────────

function LabelPreview({ data }: { data: LabelTemplateData }): JSX.Element {
  return (
    <div className="rounded-xl border-2 border-slate-700 bg-white p-4 font-serif text-sm">
      <div className="mb-3 border-b-4 border-slate-900 pb-2 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-600">Product Label</p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">{data.productName || "Product Name"}</h2>
        {data.manufacturer && <p className="text-xs text-slate-600">{data.manufacturer}</p>}
      </div>

      {data.netWeight && (
        <div className="mb-2 text-right">
          <span className="text-xs font-semibold text-slate-700">Net Wt: </span>
          <span className="text-xs text-slate-900">{data.netWeight}</span>
        </div>
      )}

      {data.ingredientStatement && (
        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase text-slate-700">Ingredients:</p>
          <p className="text-[11px] leading-snug text-slate-800">{data.ingredientStatement}</p>
        </div>
      )}

      {data.allergenStatement && (
        <div className="mb-3 rounded bg-amber-50 px-2 py-1">
          <p className="text-[10px] font-bold uppercase text-amber-800">Allergen Information:</p>
          <p className="text-[11px] text-amber-900">{data.allergenStatement}</p>
        </div>
      )}

      {data.nutritionalInfo && (
        <div className="mb-3 border border-slate-700 text-[10px]">
          <div className="border-b border-slate-700 bg-slate-900 px-1 py-0.5 text-center font-bold text-white">Nutrition Facts</div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="px-1 py-0.5 text-left font-semibold text-slate-700">Nutrient</th>
                <th className="px-1 py-0.5 text-right font-semibold text-slate-700">Per 100g</th>
                <th className="px-1 py-0.5 text-right font-semibold text-slate-700">Per Serving</th>
              </tr>
            </thead>
            <tbody>
              {(["energy", "protein", "carbs", "fat", "fibre", "sodium"] as const).map((key) => {
                const labels: Record<string, string> = { energy: "Energy (kcal)", protein: "Protein (g)", carbs: "Carbohydrates (g)", fat: "Fat (g)", fibre: "Fibre (g)", sodium: "Sodium (mg)" };
                const per100 = data.nutritionalInfo?.per100g[key] ?? "";
                const perServing = data.nutritionalInfo?.perServing[key] ?? "";
                if (!per100 && !perServing) return null;
                return (
                  <tr key={key} className="border-b border-slate-100">
                    <td className="px-1 py-0.5 text-slate-700">{labels[key]}</td>
                    <td className="px-1 py-0.5 text-right text-slate-900">{per100 || "—"}</td>
                    <td className="px-1 py-0.5 text-right text-slate-900">{perServing || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data.regulatoryStatements.length > 0 && (
        <div className="mb-3">
          {data.regulatoryStatements.filter(Boolean).map((stmt, i) => (
            <p key={i} className="text-[10px] italic text-slate-600">{stmt}</p>
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-slate-200 pt-2">
        {data.countryOfOrigin && (
          <div>
            <span className="text-[9px] font-bold uppercase text-slate-500">Country of Origin: </span>
            <span className="text-[10px] text-slate-800">{data.countryOfOrigin}</span>
          </div>
        )}
        {data.shelfLife && (
          <div>
            <span className="text-[9px] font-bold uppercase text-slate-500">Best Before: </span>
            <span className="text-[10px] text-slate-800">{data.shelfLife}</span>
          </div>
        )}
        {data.storageConditions && (
          <div className="col-span-2">
            <span className="text-[9px] font-bold uppercase text-slate-500">Storage: </span>
            <span className="text-[10px] text-slate-800">{data.storageConditions}</span>
          </div>
        )}
        {data.batchFormat && (
          <div className="col-span-2">
            <span className="text-[9px] font-bold uppercase text-slate-500">Batch: </span>
            <span className="font-mono text-[10px] text-slate-800">{data.batchFormat}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tag Input ─────────────────────────────────────────────────────────────────

function TagInput({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }): JSX.Element {
  const [input, setInput] = useState("");

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput("");
  };

  const removeTag = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {values.map((tag, i) => (
          <span key={i} className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs text-blue-800">
            {tag}
            <button type="button" onClick={() => removeTag(i)} className="text-blue-500 hover:text-blue-700">✕</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
          placeholder="Type and press Enter to add..."
          className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button type="button" onClick={addTag} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm">
          Add
        </button>
      </div>
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <h4 className="mb-3 border-b border-slate-200 pb-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">
      {children}
    </h4>
  );
}

// ─── Form Field ────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

// ─── Formula Linker ────────────────────────────────────────────────────────────

function FormulaLinker({
  formulaId,
  formula,
  onLink
}: {
  formulaId: string | undefined;
  formula: FormulaSearchResult | null | undefined;
  onLink: (id: string | null) => void;
}): JSX.Element {
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);

  const results = useQuery({
    queryKey: ["formula-link-search", search],
    queryFn: async () =>
      (await api.get<{ data: FormulaSearchResult[] }>("/formulas", { params: { search, pageSize: 20 } })).data,
    enabled: showResults && search.length >= 1
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <SectionHeader>Linked Formula</SectionHeader>
      {formulaId && formula ? (
        <div className="flex items-center justify-between rounded border border-green-200 bg-green-50 p-2">
          <div>
            <span className="font-mono text-xs text-slate-500">{formula.formulaCode} v{formula.version}</span>
            <p className="text-sm font-medium text-slate-800">{formula.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={formula.status} />
            <button
              type="button"
              onClick={() => onLink(null)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Unlink
            </button>
            <Link to={`/formulas/${formula.id}`} className="text-xs text-primary hover:underline">
              View
            </Link>
          </div>
        </div>
      ) : (
        <div className="relative">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            placeholder="Search formula by code or name..."
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
          {showResults && results.data?.data && results.data.data.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow-lg">
              {results.data.data.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                  onClick={() => {
                    onLink(f.id);
                    setSearch(`${f.formulaCode} — ${f.name}`);
                    setShowResults(false);
                  }}
                >
                  <span className="font-mono text-xs text-slate-500">{f.formulaCode} v{f.version}</span>
                  <span className="ml-2 text-slate-700">{f.name}</span>
                </button>
              ))}
            </div>
          )}
          {showResults && search.length >= 1 && results.data?.data.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">No formulas found.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Nutritional Grid ─────────────────────────────────────────────────────────

function NutritionalGrid({
  per100g,
  perServing,
  onChange
}: {
  per100g: NutritionalRow;
  perServing: NutritionalRow;
  onChange: (field: "per100g" | "perServing", key: keyof NutritionalRow, value: string) => void;
}): JSX.Element {
  const nutrients: Array<{ key: keyof NutritionalRow; label: string }> = [
    { key: "energy", label: "Energy (kcal)" },
    { key: "protein", label: "Protein (g)" },
    { key: "carbs", label: "Carbohydrates (g)" },
    { key: "fat", label: "Fat (g)" },
    { key: "fibre", label: "Fibre (g)" },
    { key: "sodium", label: "Sodium (mg)" }
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Nutrient</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Per 100g</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Per Serving</th>
          </tr>
        </thead>
        <tbody>
          {nutrients.map(({ key, label }) => (
            <tr key={key} className="border-b border-slate-100">
              <td className="px-3 py-1.5 text-xs text-slate-700">{label}</td>
              <td className="px-3 py-1">
                <input
                  value={per100g[key]}
                  onChange={(e) => onChange("per100g", key, e.target.value)}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                  placeholder="—"
                />
              </td>
              <td className="px-3 py-1">
                <input
                  value={perServing[key]}
                  onChange={(e) => onChange("perServing", key, e.target.value)}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                  placeholder="—"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Detail / Edit Form ────────────────────────────────────────────────────────

interface TemplateFormProps {
  initial: LabelTemplate | null;
  containerId: string | null;
  onSave: (newId?: string) => void;
  onCancel: () => void;
}

function TemplateForm({ initial, containerId, onSave, onCancel }: TemplateFormProps): JSX.Element {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<LabelTemplateData>(() =>
    initial?.templateData ? { ...initial.templateData } : emptyData()
  );
  const [showNutritional, setShowNutritional] = useState(() => initial?.templateData?.nutritionalInfo !== null && initial?.templateData?.nutritionalInfo !== undefined);
  const [per100g, setPer100g] = useState<NutritionalRow>(() => initial?.templateData?.nutritionalInfo?.per100g ?? emptyNutritionalRow());
  const [perServing, setPerServing] = useState<NutritionalRow>(() => initial?.templateData?.nutritionalInfo?.perServing ?? emptyNutritionalRow());
  const [linkedFormula, setLinkedFormula] = useState<FormulaSearchResult | null | undefined>(initial?.formula ?? null);

  const set = <K extends keyof LabelTemplateData>(key: K, value: LabelTemplateData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleNutritionalChange = (field: "per100g" | "perServing", key: keyof NutritionalRow, value: string) => {
    if (field === "per100g") {
      setPer100g((prev) => ({ ...prev, [key]: value }));
    } else {
      setPerServing((prev) => ({ ...prev, [key]: value }));
    }
  };

  const handleLinkFormula = (id: string | null) => {
    set("formulaId", id ?? undefined);
    if (!id) { setLinkedFormula(null); setComposition([]); }
  };

  // ── Generate from Formula ──────────────────────────────────────────────────
  const [composition, setComposition] = useState<CompositionRow[]>([]);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!form.formulaId) return;
    setGenerating(true);
    try {
      const res = await api.get<FormulaLabelData>(`/labels/formulas/${form.formulaId}`);
      const d = res.data;

      // Auto-populate product name from linked FG item (if not already filled in)
      if (d.outputItem && !form.productName.trim()) {
        set("productName", d.outputItem.name);
      }

      // Auto-populate ingredient statement (declaration sorted by weight desc)
      if (d.declaration.length > 0) {
        set("ingredientStatement", d.declaration.join(", "));
      }

      // Auto-populate allergen statement
      if (d.allergens.length > 0) {
        const formatted = `Contains: ${d.allergens.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(", ")}.`;
        set("allergenStatement", formatted);
      }

      // Auto-populate nutritional info from linked specs if present
      if (d.nutrition.length > 0) {
        const nutMap: Record<string, string> = {};
        for (const row of d.nutrition) {
          const key = row.attribute.toLowerCase().replace(/[^a-z]/g, "");
          const val = row.value ?? (row.minValue !== null ? String(row.minValue) : "");
          if (key.includes("energy") || key.includes("kcal")) nutMap["energy"] = val;
          else if (key.includes("protein")) nutMap["protein"] = val;
          else if (key.includes("carb")) nutMap["carbs"] = val;
          else if (key.includes("fat")) nutMap["fat"] = val;
          else if (key.includes("fibre") || key.includes("fiber")) nutMap["fibre"] = val;
          else if (key.includes("sodium") || key.includes("salt")) nutMap["sodium"] = val;
        }
        const hasNutrition = Object.values(nutMap).some(Boolean);
        if (hasNutrition) {
          setPer100g((prev) => ({ ...prev, ...nutMap }));
          setShowNutritional(true);
        }
      }

      setComposition(d.composition);

      const parts: string[] = ["Ingredients populated from formula."];
      if (d.outputItem) parts.push(`Product name: ${d.outputItem.name}.`);
      if (d.allergens.length > 0) parts.push(`${d.allergens.length} allergen(s) detected.`);
      toast.success(parts.join(" ") + " Review and edit before saving.");
    } catch {
      toast.error("Failed to generate from formula.");
    } finally {
      setGenerating(false);
    }
  };

  // Fetch formula details when formulaId is set but linkedFormula isn't loaded
  useQuery({
    queryKey: ["formula-for-label", form.formulaId],
    queryFn: async () => {
      const result = await api.get<FormulaSearchResult>(`/formulas/${form.formulaId}`);
      setLinkedFormula(result.data);
      return result.data;
    },
    enabled: Boolean(form.formulaId) && !linkedFormula
  });

  const payload = useMemo((): LabelTemplateData => ({
    ...form,
    nutritionalInfo: showNutritional ? { per100g, perServing } : null
  }), [form, showNutritional, per100g, perServing]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const body = { ...payload, ...(containerId ? { containerId } : {}) };
      return api.post<LabelTemplate>("/labels", body);
    },
    onSuccess: async (res) => {
      toast.success("Label template created.");
      await queryClient.invalidateQueries({ queryKey: ["label-templates"] });
      onSave(res.data.id);
    },
    onError: (error) => toast.error((error as Error).message ?? "Save failed.")
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!initial) throw new Error("No template to update.");
      return api.patch<LabelTemplate>(`/labels/${initial.id}`, payload);
    },
    onSuccess: async () => {
      toast.success("Label template updated.");
      await queryClient.invalidateQueries({ queryKey: ["label-templates"] });
      onSave();
    },
    onError: (error) => toast.error((error as Error).message ?? "Save failed.")
  });

  const handleSubmit = () => {
    if (!form.productName.trim()) {
      toast.error("Product Name is required.");
      return;
    }
    if (initial) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-1 gap-6 overflow-hidden">
      {/* Form column */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-2">

        <FormulaLinker
          formulaId={form.formulaId}
          formula={linkedFormula}
          onLink={handleLinkFormula}
        />

        {/* Product Identity */}
        <div className="space-y-4">
          <SectionHeader>Product Identity</SectionHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product Name *">
              <input
                value={form.productName}
                onChange={(e) => set("productName", e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. Tropical Fruit Drink"
              />
            </Field>
            <Field label="Net Weight">
              <input
                value={form.netWeight}
                onChange={(e) => set("netWeight", e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. 250ml"
              />
            </Field>
            <Field label="Country of Origin">
              <input
                value={form.countryOfOrigin}
                onChange={(e) => set("countryOfOrigin", e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. United Kingdom"
              />
            </Field>
            <Field label="Manufacturer">
              <input
                value={form.manufacturer}
                onChange={(e) => set("manufacturer", e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. Acme Foods Ltd."
              />
            </Field>
          </div>
        </div>

        {/* Ingredient & Allergen */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionHeader>Ingredient &amp; Allergen</SectionHeader>
            {form.formulaId && (
              <button
                type="button"
                onClick={() => { void handleGenerate(); }}
                disabled={generating}
                className="flex items-center gap-1.5 rounded-lg border border-primary bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
              >
                {generating ? "⏳ Generating…" : "⚗️ Generate from Formula"}
              </button>
            )}
          </div>

          {!form.formulaId && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              Link a formula above, then click <strong>Generate from Formula</strong> to auto-populate the ingredient statement, allergen declaration, and nutritional data from the formula's ingredient list.
            </div>
          )}

          {/* Composition breakdown — shown after generation */}
          {composition.length > 0 && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
              <p className="mb-2 text-xs font-semibold text-blue-700">Formula Composition (sorted by weight — used to build ingredient statement)</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="pb-1 font-medium">Ingredient</th>
                    <th className="pb-1 font-medium">Code</th>
                    <th className="pb-1 text-right font-medium">% by weight</th>
                  </tr>
                </thead>
                <tbody>
                  {composition.map((row) => (
                    <tr key={row.code} className="border-t border-blue-100">
                      <td className="py-0.5 text-slate-800">{row.name}</td>
                      <td className="py-0.5 font-mono text-slate-500">{row.code}</td>
                      <td className="py-0.5 text-right font-medium text-blue-800">
                        {row.percentage !== null ? `${row.percentage.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[10px] text-blue-500">Ingredients with &lt;2% may be listed in any order after the threshold. Edit the statement above as needed for regulatory compliance.</p>
            </div>
          )}

          <Field label="Ingredient Statement">
            <textarea
              value={form.ingredientStatement}
              onChange={(e) => set("ingredientStatement", e.target.value)}
              rows={3}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Link a formula and click Generate, or type manually…"
            />
          </Field>
          <Field label="Allergen Statement">
            <textarea
              value={form.allergenStatement}
              onChange={(e) => set("allergenStatement", e.target.value)}
              rows={2}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Contains: Milk, Wheat. May contain: Nuts."
            />
          </Field>
        </div>

        {/* Nutritional */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeader>Nutritional Information</SectionHeader>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={showNutritional}
                onChange={(e) => setShowNutritional(e.target.checked)}
                className="rounded"
              />
              Include Nutrition Panel
            </label>
          </div>
          {showNutritional && (
            <NutritionalGrid
              per100g={per100g}
              perServing={perServing}
              onChange={handleNutritionalChange}
            />
          )}
        </div>

        {/* Regulatory */}
        <div className="space-y-4">
          <SectionHeader>Regulatory</SectionHeader>
          <Field label="Regulatory Statements">
            <TagInput
              values={form.regulatoryStatements}
              onChange={(v) => set("regulatoryStatements", v)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Shelf Life">
              <input
                value={form.shelfLife}
                onChange={(e) => set("shelfLife", e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. 18 months from manufacture"
              />
            </Field>
            <Field label="Storage Conditions">
              <input
                value={form.storageConditions}
                onChange={(e) => set("storageConditions", e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. Store below 25°C in a dry place"
              />
            </Field>
          </div>
        </div>

        {/* Batch & Traceability */}
        <div className="space-y-4">
          <SectionHeader>Batch &amp; Traceability</SectionHeader>
          <Field label="Batch Format">
            <input
              value={form.batchFormat}
              onChange={(e) => set("batchFormat", e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
              placeholder="e.g. YYYYMMDD-XXXX"
            />
          </Field>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSaving ? "Saving..." : initial ? "Update Template" : "Create Template"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Preview column */}
      <div className="w-72 shrink-0">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Label Preview</p>
        <LabelPreview data={payload} />
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function LabelingPage(): JSX.Element {
  const { selectedContainerId } = useContainerStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  // Tracks whether we've already done the initial auto-select — prevents
  // the effect from re-selecting filtered[0] every time the list refreshes
  // after a save, which was blocking creation of a second template.
  const hasAutoSelectedRef = useRef(false);

  const templates = useQuery({
    queryKey: ["label-templates", selectedContainerId],
    queryFn: async () =>
      (await api.get<LabelListResponse>("/labels", {
        params: { ...(selectedContainerId ? { containerId: selectedContainerId } : {}) }
      })).data
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => api.delete(`/labels/${id}`),
    onSuccess: async () => {
      toast.success("Template deleted.");
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["label-templates"] });
    },
    onError: () => toast.error("Failed to delete template.")
  });

  const filtered = useMemo(() => {
    const list = templates.data?.data ?? [];
    if (!search.trim()) return list;
    const term = search.toLowerCase();
    return list.filter((t) =>
      (t.productName + " " + (t.formula?.formulaCode ?? "")).toLowerCase().includes(term)
    );
  }, [templates.data?.data, search]);

  const selectedTemplate = filtered.find((t) => t.id === selectedId) ?? null;

  // Load full detail when selected
  const detail = useQuery({
    queryKey: ["label-template-detail", selectedId],
    queryFn: async () => (await api.get<LabelTemplate>(`/labels/${selectedId}`)).data,
    enabled: Boolean(selectedId) && !isCreating
  });

  // Auto-select the first template on initial page load only.
  // Using a ref flag ensures this runs exactly once and never fires again
  // after saves, preventing the bug where creating a second template would
  // jump back to the first one.
  useEffect(() => {
    if (!hasAutoSelectedRef.current && !selectedId && filtered.length > 0 && !isCreating) {
      hasAutoSelectedRef.current = true;
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId, isCreating]);

  const handleNew = () => {
    setSelectedId(null);
    setIsCreating(true);
  };

  const handleSave = (newId?: string) => {
    setIsCreating(false);
    // If a newly created template's ID was returned, navigate to it automatically
    if (newId) {
      setSelectedId(newId);
    }
    void queryClient.invalidateQueries({ queryKey: ["label-templates"] });
  };

  const handleCancel = () => {
    setIsCreating(false);
  };

  return (
    <div className="flex h-full gap-4 overflow-hidden">
      {/* Left panel: list */}
      <div className="flex w-72 shrink-0 flex-col rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Labeling</p>
          <h2 className="font-heading text-xl font-bold text-slate-800">Label Templates</h2>
          <p className="text-xs text-slate-400">Manage product label content.</p>
        </div>

        <button
          type="button"
          onClick={handleNew}
          className="mb-3 w-full rounded bg-primary py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          + New Label Template
        </button>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates..."
          className="mb-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />

        <div className="flex-1 space-y-1.5 overflow-y-auto">
          {templates.isLoading ? (
            <p className="text-xs text-slate-400">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-slate-400">No label templates yet.</p>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setSelectedId(t.id); setIsCreating(false); }}
                className={`group w-full rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${
                  selectedTemplate?.id === t.id && !isCreating
                    ? "border-primary bg-blue-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800 truncate">{t.productName}</span>
                  <StatusBadge status={t.status} />
                </div>
                {t.formula ? (
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400">{t.formula.formulaCode} v{t.formula.version}</p>
                ) : (
                  <p className="mt-0.5 text-[10px] italic text-slate-400">No formula linked</p>
                )}
                <p className="mt-0.5 font-mono text-[10px] text-slate-300">{t.docNumber}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel: form or detail */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-5">
        {isCreating ? (
          <>
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs uppercase text-slate-500">New Template</p>
                <h3 className="font-heading text-lg font-semibold text-slate-800">Create Label Template</h3>
              </div>
            </div>
            <TemplateForm
              initial={null}
              containerId={selectedContainerId}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </>
        ) : selectedId && detail.data ? (
          <>
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="font-mono text-xs text-slate-400">{detail.data.docNumber}</p>
                <h3 className="font-heading text-lg font-semibold text-slate-800">{detail.data.productName}</h3>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={detail.data.status} />
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Delete this label template?")) {
                      deleteTemplate.mutate(detail.data.id);
                    }
                  }}
                  className="rounded border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-600 hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
            <TemplateForm
              initial={detail.data}
              containerId={selectedContainerId}
              onSave={handleSave}
              onCancel={() => void queryClient.invalidateQueries({ queryKey: ["label-template-detail", selectedId] })}
            />
          </>
        ) : detail.isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-slate-400">Loading template...</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-slate-400">Select a label template or create a new one.</p>
            <button
              type="button"
              onClick={handleNew}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              + New Label Template
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
