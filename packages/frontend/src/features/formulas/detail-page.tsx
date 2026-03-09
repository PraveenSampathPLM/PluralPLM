import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STANDARD_UOMS } from "@/lib/uom";
import { EntityIcon } from "@/components/entity-icon";

type RecipeType = "FORMULA_RECIPE" | "FINISHED_GOOD_RECIPE";
type InputSourceType = "ITEM" | "FORMULA";

interface FormulaDetail {
 id: string;
 formulaCode: string;
 version: number;
 name: string;
 status: string;
 recipeType: RecipeType;
 industryType?: string;
 outputItem?: { id: string; itemCode: string; name: string; itemType: string } | null;
 ingredients?: Array<{
  id: string;
  quantity: number;
  uom: string;
  percentage?: number | null;
  additionSequence?: number | null;
  item?: { id: string; itemCode: string; name: string };
  inputFormula?: { id: string; formulaCode: string; version: number; name: string };
 }>;
}

interface FormulaLinksResponse {
 boms: Array<{ id: string; bomCode: string; version: number; type: string }>;
 specifications: Array<{ id: string; specType: string; attribute: string; value?: string | null; minValue?: number | null; maxValue?: number | null; uom?: string | null }>;
 relatedChanges: Array<{ id: string; crNumber: string; title: string; status: string }>;
 workflows: Array<{ id: string; currentState: string }>;
}

interface LabelPreview {
 declaration: string[];
 composition: Array<{ name: string; code: string; percentage: number | null }>;
 allergens: string[];
 nutrition?: Array<{ attribute: string; value: string | null; minValue: number | null; maxValue: number | null; uom: string | null }>;
}

interface FormulaHistoryResponse {
  currentId: string;
  history: Array<{
    id: string;
    formulaCode: string;
    version: number;
    revisionLabel: string;
    status: string;
    name: string;
    updatedAt: string;
  }>;
}

interface UomResponse {
 data: Array<{ value: string; label: string; category: string }>;
}

interface IngredientRow {
 sourceType: InputSourceType;
 sourceId: string;
 quantity: string;
 uom: string;
 percentage: string;
 additionSequence: string;
}

interface ItemOption {
 id: string;
 name: string;
 itemCode: string;
 itemType: "RAW_MATERIAL" | "INTERMEDIATE" | "FINISHED_GOOD" | "PACKAGING";
}

interface FormulaListRow {
 id: string;
 formulaCode: string;
 version: number;
 name: string;
 recipeType: RecipeType;
}

export function FormulaDetailPage(): JSX.Element {
 const params = useParams();
 const formulaId = String(params.id ?? "");
 const queryClient = useQueryClient();
 const [message, setMessage] = useState("");
 const [isEditing, setIsEditing] = useState(false);
 const [isEditingSpecs, setIsEditingSpecs] = useState(false);
 const [draftOutputItemId, setDraftOutputItemId] = useState("");
 const [draftLines, setDraftLines] = useState<IngredientRow[]>([]);
 const [specRows, setSpecRows] = useState<
  Array<{
   clientId: string;
   id?: string;
   specType: string;
   attribute: string;
   value: string;
   minValue: string;
   maxValue: string;
   uom: string;
   testMethod: string;
  }>
 >([]);
 const [activeTab, setActiveTab] = useState<"details" | "history" | "labeling">("details");

 function renumberLines(rows: IngredientRow[]): IngredientRow[] {
  return rows.map((row, index) => ({ ...row, additionSequence: String(index + 1) }));
 }

 function moveLine(index: number, direction: -1 | 1): void {
  setDraftLines((prev) => {
   const target = index + direction;
   if (target < 0 || target >= prev.length) {
    return prev;
   }
   const next = [...prev];
   [next[index], next[target]] = [next[target], next[index]];
   return renumberLines(next);
  });
 }

 const formula = useQuery({
  queryKey: ["formula-detail-page", formulaId],
  queryFn: async () => (await api.get<FormulaDetail>(`/formulas/${formulaId}`)).data,
  enabled: Boolean(formulaId)
 });

 const links = useQuery({
  queryKey: ["formula-links-page", formulaId],
  queryFn: async () => (await api.get<FormulaLinksResponse>(`/formulas/${formulaId}/links`)).data,
  enabled: Boolean(formulaId)
 });

 const history = useQuery({
  queryKey: ["formula-history", formulaId],
  queryFn: async () => (await api.get<FormulaHistoryResponse>(`/formulas/${formulaId}/history`)).data,
  enabled: Boolean(formulaId)
 });
 const uomsQuery = useQuery({
  queryKey: ["config-uoms"],
  queryFn: async () => (await api.get<UomResponse>("/config/uoms")).data,
  retry: false
 });
 const specTemplates = useQuery({
  queryKey: ["spec-templates", formula.data?.industryType ?? "CHEMICAL"],
  queryFn: async () =>
   (
    await api.get<{ data: Array<{ specType: string; label: string; attributes: Array<{ key: string; defaultUom?: string; defaultTestMethod?: string }> }> }>(
      `/specifications/templates/${formula.data?.industryType ?? "CHEMICAL"}`
    )
   ).data
 });
 const labelPreview = useQuery({
  queryKey: ["label-preview", formulaId],
  queryFn: async () => (await api.get<LabelPreview>(`/labels/formulas/${formulaId}`)).data,
  enabled: Boolean(formulaId && formula.data?.industryType === "FOOD_BEVERAGE")
 });

 const latestId = useMemo(() => history.data?.history?.[0]?.id, [history.data?.history]);
 const isOldVersion = Boolean(latestId && latestId !== formulaId);

 const items = useQuery({
  queryKey: ["formula-detail-items"],
  queryFn: async () => (await api.get<{ data: ItemOption[] }>("/items", { params: { pageSize: 500 } })).data
 });

 const formulas = useQuery({
  queryKey: ["formula-detail-formulas"],
  queryFn: async () =>
   (await api.get<{ data: FormulaListRow[] }>("/formulas", { params: { pageSize: 500 } })).data
 });

 const updateStructure = useMutation({
  mutationFn: async () => {
   const mapped = draftLines
    .filter((row) => row.sourceId && row.quantity)
    .map((row, index) => ({
     ...(row.sourceType === "ITEM" ? { itemId: row.sourceId } : { inputFormulaId: row.sourceId }),
     quantity: Number(row.quantity),
     uom: row.uom || "kg",
     ...(row.percentage ? { percentage: Number(row.percentage) } : {}),
     additionSequence: row.additionSequence ? Number(row.additionSequence) : index + 1
    }));

   if (mapped.length === 0) {
    throw new Error("Add at least one ingredient line.");
   }

   if (formula.data?.recipeType === "FINISHED_GOOD_RECIPE" && !draftOutputItemId) {
    throw new Error("Finished Good Recipe requires an output finished good item.");
   }

   await api.put(`/formulas/${formulaId}/structure`, {
    outputItemId: formula.data?.recipeType === "FINISHED_GOOD_RECIPE" ? draftOutputItemId : null,
    ingredients: mapped
   });
  },
  onSuccess: async () => {
   setMessage("Formulation updated.");
   setIsEditing(false);
   await queryClient.invalidateQueries({ queryKey: ["formula-detail-page", formulaId] });
   await queryClient.invalidateQueries({ queryKey: ["formula-links-page", formulaId] });
   await queryClient.invalidateQueries({ queryKey: ["formulas"] });
  },
  onError: (error) => {
   setMessage(error instanceof Error ? error.message : "Update failed");
  }
 });

 async function downloadMsds(): Promise<void> {
  if (!formulaId) {
   return;
  }
  try {
   const response = await api.get(`/formulas/${formulaId}/msds-pdf`, { responseType: "blob" });
   const blob = new Blob([response.data], { type: "application/pdf" });
   const url = window.URL.createObjectURL(blob);
   const link = document.createElement("a");
   const code = formula.data?.formulaCode ?? "MSDS";
   link.href = url;
   link.download = `${code}-MSDS.pdf`;
   document.body.appendChild(link);
   link.click();
   link.remove();
   window.URL.revokeObjectURL(url);
  } catch (error) {
   setMessage(error instanceof Error ? error.message : "Failed to download MSDS.");
  }
 }

 const saveSpecs = useMutation({
  mutationFn: async () => {
   await api.post("/specifications/bulk-upsert", {
    targetType: "formula",
    targetId: formulaId,
    replaceExisting: true,
    specs: specRows.map((row) => ({
     id: row.id,
     specType: row.specType,
     attribute: row.attribute,
     value: row.value?.trim() || undefined,
     minValue: row.minValue ? Number(row.minValue) : undefined,
     maxValue: row.maxValue ? Number(row.maxValue) : undefined,
     uom: row.uom?.trim() || undefined,
     testMethod: row.testMethod?.trim() || undefined
    }))
   });
  },
  onSuccess: async () => {
   setIsEditingSpecs(false);
   setMessage("Specifications saved.");
   await queryClient.invalidateQueries({ queryKey: ["formula-links-page", formulaId] });
  },
  onError: (error) => {
   setMessage(error instanceof Error ? error.message : "Failed to save specifications.");
  }
 });

 useEffect(() => {
  if (!formula.data) {
   return;
  }
  setDraftOutputItemId(formula.data.outputItem?.id ?? "");
  const rows =
   formula.data.ingredients?.map((ingredient) => ({
    sourceType: ingredient.item?.id ? "ITEM" : "FORMULA",
    sourceId: ingredient.item?.id ?? ingredient.inputFormula?.id ?? "",
    quantity: String(ingredient.quantity ?? ""),
    uom: ingredient.uom ?? "kg",
    percentage: ingredient.percentage ? String(ingredient.percentage) : "",
    additionSequence: ingredient.additionSequence ? String(ingredient.additionSequence) : ""
   })) ?? [];
  setDraftLines(
   rows.length
    ? rows
    : [{ sourceType: "ITEM", sourceId: "", quantity: "", uom: "kg", percentage: "", additionSequence: "1" }]
  );
 }, [formula.data?.id, isEditing]);

 const itemOptions = useMemo(() => {
  const base = items.data?.data ?? [];
  if (formula.data?.recipeType === "FORMULA_RECIPE") {
   return base.filter((item) => item.itemType === "RAW_MATERIAL" || item.itemType === "INTERMEDIATE");
  }
  return base.filter((item) => item.itemType === "PACKAGING");
 }, [items.data?.data, formula.data?.recipeType]);

 const finishedGoods = useMemo(
  () => (items.data?.data ?? []).filter((item) => item.itemType === "FINISHED_GOOD"),
  [items.data?.data]
 );

 const inputFormulaOptions = useMemo(() => {
  const base = formulas.data?.data ?? [];
  return base.filter((row) => row.recipeType === "FORMULA_RECIPE" && row.id !== formulaId);
 }, [formulas.data?.data, formulaId]);

 const validationWarnings = useMemo(() => {
  if (!isEditing) {
   return [];
  }
  const warnings: string[] = [];
  const itemById = new Map((items.data?.data ?? []).map((item) => [item.id, item]));
  const formulaById = new Map((formulas.data?.data ?? []).map((row) => [row.id, row]));
  const activeLines = draftLines.filter((line) => line.sourceId);

  if (formula.data?.recipeType === "FINISHED_GOOD_RECIPE") {
   if (!draftOutputItemId) {
    warnings.push("Finished Good Recipe requires an output finished good item.");
   }
   if (!activeLines.some((line) => line.sourceType === "FORMULA")) {
    warnings.push("Finished Good Recipe requires at least one formula input.");
   }
   for (const [index, line] of activeLines.entries()) {
    if (line.sourceType === "ITEM") {
     const item = itemById.get(line.sourceId);
     if (item && item.itemType !== "PACKAGING") {
      warnings.push(`Line ${index + 1}: Finished Good Recipe item inputs must be Packaging.`);
     }
    }
    if (line.sourceType === "FORMULA") {
     const formulaRow = formulaById.get(line.sourceId);
     if (formulaRow && formulaRow.recipeType !== "FORMULA_RECIPE") {
      warnings.push(`Line ${index + 1}: input formula must be a Formula recipe.`);
     }
    }
   }
  } else {
   if (draftOutputItemId) {
    warnings.push("Formula Recipe output is the formula itself. Do not set output item.");
   }
   for (const [index, line] of activeLines.entries()) {
    if (line.sourceType === "ITEM") {
     const item = itemById.get(line.sourceId);
     if (item && !["RAW_MATERIAL", "INTERMEDIATE"].includes(item.itemType)) {
      warnings.push(`Line ${index + 1}: Formula Recipe item inputs must be Raw Material or Intermediate.`);
     }
    }
    if (line.sourceType === "FORMULA") {
     const formulaRow = formulaById.get(line.sourceId);
     if (formulaRow && formulaRow.recipeType !== "FORMULA_RECIPE") {
      warnings.push(`Line ${index + 1}: input formula must be a Formula recipe.`);
     }
    }
   }
  }

  return warnings;
 }, [isEditing, draftLines, formula.data?.recipeType, draftOutputItemId, items.data?.data, formulas.data?.data]);

 if (formula.isLoading || links.isLoading) {
  return <div className="rounded-lg bg-white p-4">Loading formulation details...</div>;
 }

  return (
  <div className="space-y-4 rounded-xl bg-white p-4">
   <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
     <div className="rounded-full bg-slate-100 p-2">
      <EntityIcon kind="formula" size={20} />
     </div>
     <div>
     <p className="font-mono text-sm text-slate-500">
      {formula.data?.formulaCode} v{formula.data?.version}
     </p>
     <h2 className="font-heading text-xl">{formula.data?.name}</h2>
     <p className="text-sm text-slate-500">
      Type: {formula.data?.recipeType === "FORMULA_RECIPE" ? "Formula" : "Finished Good"} | Status: {formula.data?.status}
     </p>
     </div>
    </div>
    <div className="flex items-center gap-2">
     <button
      type="button"
      onClick={() => void downloadMsds()}
      className="rounded border border-slate-300 bg-white px-3 py-1 text-sm"
     >
      Download MSDS
     </button>
     {formula.data?.status === "DRAFT" ? (
      isEditing ? (
       <>
        <button
         onClick={() => updateStructure.mutate()}
         className="rounded bg-primary px-3 py-1 text-sm text-white"
         type="button"
        >
         Save
        </button>
        <button
         onClick={() => setIsEditing(false)}
         className="rounded border border-slate-300 bg-white px-3 py-1 text-sm"
         type="button"
        >
         Cancel
        </button>
       </>
      ) : (
       <button
        onClick={() => setIsEditing(true)}
        className="rounded border border-slate-300 bg-white px-3 py-1 text-sm"
        type="button"
       >
        Edit Structure
       </button>
      )
     ) : null}
     <Link to="/formulas" className="rounded border border-slate-300 bg-white px-3 py-1 text-sm">
      Back to Formulation
     </Link>
    </div>
   </div>

   {message ? <p className="text-sm text-slate-600">{message}</p> : null}

   <div className="flex items-center gap-2 border-b border-slate-200 text-sm">
    <button
     type="button"
     onClick={() => setActiveTab("details")}
     className={`px-3 py-2 ${activeTab === "details" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`}
    >
     Details
    </button>
    <button
     type="button"
     onClick={() => setActiveTab("history")}
     className={`px-3 py-2 ${activeTab === "history" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`}
    >
     History
    </button>
    {formula.data?.industryType === "FOOD_BEVERAGE" ? (
     <button
      type="button"
      onClick={() => setActiveTab("labeling")}
      className={`px-3 py-2 ${activeTab === "labeling" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`}
     >
      Labeling
     </button>
    ) : null}
   </div>

   {isOldVersion ? (
    <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
     You are viewing an old version of this formulation. Use the History tab to navigate to the latest version.
    </div>
   ) : null}

   {activeTab === "details" ? (
    <>
    {formula.data?.recipeType === "FINISHED_GOOD_RECIPE" ? (
    isEditing ? (
     <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
      <p className="mb-1 font-medium">Output Finished Good</p>
      <select
       className="w-full rounded border border-slate-300 bg-white px-2 py-1"
       value={draftOutputItemId}
       onChange={(event) => setDraftOutputItemId(event.target.value)}
      >
       <option value="">Select Finished Good</option>
       {finishedGoods.map((item) => (
        <option key={item.id} value={item.id}>
         {item.itemCode} - {item.name}
        </option>
       ))}
      </select>
     </div>
    ) : formula.data?.outputItem ? (
     <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
      <p className="mb-1 font-medium">Output</p>
      <Link to={`/items/${formula.data.outputItem.id}`} className="text-primary hover:underline">
       {formula.data.outputItem.itemCode} - {formula.data.outputItem.name}
      </Link>
     </div>
    ) : null
   ) : formula.data?.outputItem ? (
    <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
     <p className="mb-1 font-medium">Output</p>
     <Link to={`/items/${formula.data.outputItem.id}`} className="text-primary hover:underline">
      {formula.data.outputItem.itemCode} - {formula.data.outputItem.name}
     </Link>
    </div>
   ) : null}

   <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
    <div className="mb-2 flex items-center justify-between">
     <p className="font-medium">Input Structure</p>
     {isEditing ? (
      <button
       type="button"
       className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
       onClick={() =>
        setDraftLines((prev) =>
         renumberLines([
          ...prev,
          { sourceType: "ITEM", sourceId: "", quantity: "", uom: "kg", percentage: "", additionSequence: String(prev.length + 1) }
         ])
        )
       }
      >
       Add Line
      </button>
     ) : null}
    </div>
    {isEditing && validationWarnings.length ? (
     <div className="mb-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
      {validationWarnings.map((warning, index) => (
       <p key={`${warning}-${index}`}>{warning}</p>
      ))}
     </div>
    ) : null}
    <div className="overflow-x-auto rounded border border-slate-200 bg-white">
     <table className="w-full text-left text-sm">
      <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
       <tr>
        <th className="px-2 py-2">Line</th>
        <th className="px-2 py-2">Source</th>
        <th className="px-2 py-2">Quantity</th>
        <th className="px-2 py-2">UOM</th>
        <th className="px-2 py-2">%</th>
        <th className="px-2 py-2">Seq</th>
        {isEditing ? <th className="px-2 py-2 text-right">Actions</th> : null}
       </tr>
      </thead>
      <tbody>
       {isEditing
        ? draftLines.map((row, index) => (
           <tr key={`${row.sourceId}-${index}`} className="border-b border-slate-100">
            <td className="px-2 py-2">{index + 1}</td>
            <td className="px-2 py-2">
             <div className="flex gap-2">
              <select
               className="rounded border border-slate-300 bg-white px-2 py-1"
               value={row.sourceType}
               onChange={(event) =>
                setDraftLines((prev) =>
                 prev.map((line, lineIndex) =>
                  lineIndex === index ? { ...line, sourceType: event.target.value as InputSourceType, sourceId: "" } : line
                 )
                )
               }
              >
               <option value="ITEM">Item</option>
               <option value="FORMULA">Formula</option>
              </select>
              <select
               className="min-w-[200px] rounded border border-slate-300 bg-white px-2 py-1"
               value={row.sourceId}
               onChange={(event) =>
                setDraftLines((prev) => prev.map((line, lineIndex) => (lineIndex === index ? { ...line, sourceId: event.target.value } : line)))
               }
              >
               <option value="">Select</option>
               {row.sourceType === "ITEM"
                ? itemOptions.map((item) => (
                   <option key={item.id} value={item.id}>
                    {item.itemCode} - {item.name}
                   </option>
                  ))
                : inputFormulaOptions.map((formulaOption) => (
                   <option key={formulaOption.id} value={formulaOption.id}>
                    {formulaOption.formulaCode} v{formulaOption.version} - {formulaOption.name}
                   </option>
                  ))}
              </select>
             </div>
            </td>
            <td className="px-2 py-2">
             <input
              className="w-24 rounded border border-slate-300 px-2 py-1"
              value={row.quantity}
              onChange={(event) =>
               setDraftLines((prev) => prev.map((line, lineIndex) => (lineIndex === index ? { ...line, quantity: event.target.value } : line)))
              }
             />
            </td>
            <td className="px-2 py-2">
             <select
              className="w-24 rounded border border-slate-300 bg-white px-2 py-1"
              value={row.uom}
              onChange={(event) =>
               setDraftLines((prev) => prev.map((line, lineIndex) => (lineIndex === index ? { ...line, uom: event.target.value } : line)))
              }
             >
              {(uomsQuery.data?.data ?? STANDARD_UOMS).map((uom) => (
               <option key={uom.value} value={uom.value}>
                {uom.value}
               </option>
              ))}
             </select>
            </td>
            <td className="px-2 py-2">
             <input
              className="w-20 rounded border border-slate-300 px-2 py-1"
              value={row.percentage}
              onChange={(event) =>
               setDraftLines((prev) =>
                prev.map((line, lineIndex) => (lineIndex === index ? { ...line, percentage: event.target.value } : line))
               )
              }
             />
            </td>
            <td className="px-2 py-2">
             <input
              className="w-16 rounded border border-slate-300 px-2 py-1"
              value={row.additionSequence}
              readOnly
             />
            </td>
            <td className="px-2 py-2 text-right">
             <div className="flex items-center justify-end gap-2">
              <button type="button" className="text-xs text-slate-600 hover:underline" onClick={() => moveLine(index, -1)}>
               Up
              </button>
              <button type="button" className="text-xs text-slate-600 hover:underline" onClick={() => moveLine(index, 1)}>
               Down
              </button>
              <button
               type="button"
               className="text-xs text-red-600 hover:underline"
               onClick={() => setDraftLines((prev) => renumberLines(prev.filter((_, lineIndex) => lineIndex !== index)))}
              >
               Remove
              </button>
             </div>
            </td>
           </tr>
          ))
        : formula.data?.ingredients?.map((ingredient, index) => (
           <tr key={ingredient.id} className="border-b border-slate-100">
            <td className="px-2 py-2">{index + 1}</td>
            <td className="px-2 py-2">
             {ingredient.item?.id ? (
              <Link to={`/items/${ingredient.item.id}`} className="text-primary hover:underline">
               {ingredient.item.itemCode} - {ingredient.item.name}
              </Link>
             ) : ingredient.inputFormula?.id ? (
              <Link to={`/formulas/${ingredient.inputFormula.id}`} className="text-primary hover:underline">
               {ingredient.inputFormula.formulaCode} v{ingredient.inputFormula.version} - {ingredient.inputFormula.name}
              </Link>
             ) : (
              <span>Unknown</span>
             )}
            </td>
            <td className="px-2 py-2">{ingredient.quantity}</td>
            <td className="px-2 py-2">{ingredient.uom}</td>
            <td className="px-2 py-2">{ingredient.percentage ?? "N/A"}</td>
            <td className="px-2 py-2">{ingredient.additionSequence ?? "N/A"}</td>
           </tr>
          ))}
      </tbody>
     </table>
    </div>
   </div>

   <div className="grid gap-3 md:grid-cols-2">
    <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
     <p className="mb-1 font-medium">Linked BOMs</p>
     {links.data?.boms.map((bom) => (
      <Link key={bom.id} to={`/bom/${bom.id}`} className="block text-primary hover:underline">
       {bom.bomCode} v{bom.version} ({bom.type})
      </Link>
     ))}
    </div>
    <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
     <div className="mb-2 flex items-center justify-between">
      <p className="font-medium">Specifications</p>
      {!isEditingSpecs ? (
       <button
        type="button"
        onClick={() => {
         const existing = links.data?.specifications ?? [];
         setSpecRows(
          existing.map((spec) => ({
           clientId: spec.id,
           id: spec.id,
           specType: spec.specType,
           attribute: spec.attribute,
           value: spec.value ?? "",
           minValue: spec.minValue !== null && spec.minValue !== undefined ? String(spec.minValue) : "",
           maxValue: spec.maxValue !== null && spec.maxValue !== undefined ? String(spec.maxValue) : "",
           uom: spec.uom ?? "",
           testMethod: spec.testMethod ?? ""
          }))
         );
         setIsEditingSpecs(true);
        }}
        disabled={formula.data?.status !== "DRAFT"}
        className="rounded border border-slate-300 bg-white px-3 py-1 text-xs disabled:opacity-60"
       >
        Edit Specs
       </button>
      ) : (
       <div className="flex items-center gap-2">
        <button
         type="button"
         onClick={() => saveSpecs.mutate()}
         disabled={saveSpecs.isPending}
         className="rounded bg-primary px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
        >
         {saveSpecs.isPending ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={() => setIsEditingSpecs(false)} className="rounded border border-slate-300 px-3 py-1 text-xs">
         Cancel
        </button>
       </div>
      )}
     </div>
     {isEditingSpecs ? (
      <div className="space-y-3">
       <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[860px] text-left text-xs">
         <thead className="bg-slate-100 text-[11px] uppercase text-slate-500">
          <tr>
           <th className="px-2 py-2">Type</th>
           <th className="px-2 py-2">Attribute</th>
           <th className="px-2 py-2">Value</th>
           <th className="px-2 py-2">Min</th>
           <th className="px-2 py-2">Max</th>
           <th className="px-2 py-2">UOM</th>
           <th className="px-2 py-2">Test Method</th>
           <th className="px-2 py-2">Action</th>
          </tr>
         </thead>
         <tbody>
          {specRows.map((row) => {
           const template = (specTemplates.data?.data ?? []).find((entry) => entry.specType === row.specType);
           const attributes = template?.attributes ?? [];
           return (
            <tr key={row.clientId} className="border-t border-slate-100">
             <td className="px-2 py-2">
              <select
               value={row.specType}
               onChange={(event) => {
                const nextSpecType = event.target.value;
                const nextTemplate = (specTemplates.data?.data ?? []).find((entry) => entry.specType === nextSpecType);
                const nextAttribute = nextTemplate?.attributes[0];
                setSpecRows((prev) =>
                 prev.map((line) =>
                  line.clientId === row.clientId
                   ? {
                      ...line,
                      specType: nextSpecType,
                      attribute: nextAttribute?.key ?? "",
                      uom: nextAttribute?.defaultUom ?? line.uom,
                      testMethod: nextAttribute?.defaultTestMethod ?? line.testMethod
                     }
                   : line
                 )
                );
               }}
               className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              >
               {(specTemplates.data?.data ?? []).map((option) => (
                <option key={option.specType} value={option.specType}>
                 {option.specType}
                </option>
               ))}
              </select>
             </td>
             <td className="px-2 py-2">
              <select
               value={row.attribute}
               onChange={(event) => {
                const attr = attributes.find((entry) => entry.key === event.target.value);
                setSpecRows((prev) =>
                 prev.map((line) =>
                  line.clientId === row.clientId
                   ? {
                      ...line,
                      attribute: event.target.value,
                      uom: attr?.defaultUom ?? line.uom,
                      testMethod: attr?.defaultTestMethod ?? line.testMethod
                     }
                   : line
                 )
                );
               }}
               className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              >
               {attributes.map((attribute) => (
                <option key={`${row.clientId}-${attribute.key}`} value={attribute.key}>
                 {attribute.key}
                </option>
               ))}
              </select>
             </td>
             <td className="px-2 py-2">
              <input
               value={row.value}
               onChange={(event) => setSpecRows((prev) => prev.map((line) => (line.clientId === row.clientId ? { ...line, value: event.target.value } : line)))}
               className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
             </td>
             <td className="px-2 py-2">
              <input
               value={row.minValue}
               onChange={(event) => setSpecRows((prev) => prev.map((line) => (line.clientId === row.clientId ? { ...line, minValue: event.target.value } : line)))}
               className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
             </td>
             <td className="px-2 py-2">
              <input
               value={row.maxValue}
               onChange={(event) => setSpecRows((prev) => prev.map((line) => (line.clientId === row.clientId ? { ...line, maxValue: event.target.value } : line)))}
               className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
             </td>
             <td className="px-2 py-2">
              <select
               value={row.uom}
               onChange={(event) => setSpecRows((prev) => prev.map((line) => (line.clientId === row.clientId ? { ...line, uom: event.target.value } : line)))}
               className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              >
               {(uomsQuery.data?.data ?? STANDARD_UOMS).map((uom) => (
                <option key={uom.value} value={uom.value}>
                 {uom.value}
                </option>
               ))}
              </select>
             </td>
             <td className="px-2 py-2">
              <input
               value={row.testMethod}
               onChange={(event) => setSpecRows((prev) => prev.map((line) => (line.clientId === row.clientId ? { ...line, testMethod: event.target.value } : line)))}
               className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
             </td>
             <td className="px-2 py-2">
              <button
               type="button"
               onClick={() => setSpecRows((prev) => prev.filter((line) => line.clientId !== row.clientId))}
               className="rounded border border-slate-300 px-2 py-1 text-[11px]"
              >
               Remove
              </button>
             </td>
            </tr>
           );
          })}
         </tbody>
        </table>
       </div>
       <div className="flex flex-wrap items-center gap-2">
        <button
         type="button"
         onClick={() => {
          const template = specTemplates.data?.data?.[0];
          const attribute = template?.attributes?.[0];
          setSpecRows((prev) => [
           ...prev,
           {
            clientId: `spec-${Date.now()}`,
            specType: template?.specType ?? "PHYSICAL",
            attribute: attribute?.key ?? "",
            value: "",
            minValue: "",
            maxValue: "",
            uom: attribute?.defaultUom ?? "",
            testMethod: attribute?.defaultTestMethod ?? ""
           }
          ]);
         }}
         className="rounded border border-slate-300 bg-white px-3 py-1 text-xs"
        >
         Add Spec Line
        </button>
        {formula.data?.industryType === "FOOD_BEVERAGE" ? (
         <button
          type="button"
          onClick={() => {
           const nutrition = (specTemplates.data?.data ?? []).find((template) => template.specType === "NUTRITION");
           if (!nutrition) {
            return;
           }
           setSpecRows((prev) => [
            ...prev,
            ...nutrition.attributes.map((attr) => ({
             clientId: `spec-${Date.now()}-${attr.key}`,
             specType: nutrition.specType,
             attribute: attr.key,
             value: "",
             minValue: "",
             maxValue: "",
             uom: attr.defaultUom ?? "",
             testMethod: attr.defaultTestMethod ?? ""
            }))
           ]);
          }}
          className="rounded border border-slate-300 bg-white px-3 py-1 text-xs"
         >
          Add Nutrition Panel
         </button>
        ) : null}
       </div>
      </div>
     ) : links.data?.specifications.length ? (
      <div className="overflow-hidden rounded border border-slate-200 bg-white">
       <table className="w-full text-left text-xs">
        <thead className="bg-slate-100 text-[11px] uppercase text-slate-500">
         <tr>
          <th className="px-3 py-2">Type</th>
          <th className="px-3 py-2">Attribute</th>
          <th className="px-3 py-2">Value</th>
          <th className="px-3 py-2">Min</th>
          <th className="px-3 py-2">Max</th>
          <th className="px-3 py-2">UOM</th>
         </tr>
        </thead>
        <tbody>
         {links.data?.specifications.map((spec) => (
          <tr key={spec.id} className="border-t border-slate-100">
           <td className="px-3 py-2">{spec.specType}</td>
           <td className="px-3 py-2">{spec.attribute}</td>
           <td className="px-3 py-2">{spec.value ?? "—"}</td>
           <td className="px-3 py-2">{spec.minValue ?? "—"}</td>
           <td className="px-3 py-2">{spec.maxValue ?? "—"}</td>
           <td className="px-3 py-2">{spec.uom ?? "—"}</td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>
     ) : (
      <p className="text-slate-500">No specifications defined.</p>
     )}
    </div>
   </div>

   </>
   ) : activeTab === "labeling" ? (
    <div className="grid gap-4 md:grid-cols-2">
     <div className="rounded border border-slate-200 bg-white p-4 text-sm">
      <h3 className="mb-2 font-medium text-slate-700">Ingredient Declaration</h3>
      {labelPreview.isLoading ? (
       <p className="text-slate-500">Loading label preview...</p>
      ) : labelPreview.data?.declaration?.length ? (
       <ol className="list-decimal space-y-1 pl-5 text-slate-700">
        {labelPreview.data.declaration.map((line, index) => (
         <li key={`${line}-${index}`}>{line}</li>
        ))}
       </ol>
      ) : (
       <p className="text-slate-500">No declaration available for this formula.</p>
      )}
     </div>
     <div className="rounded border border-slate-200 bg-white p-4 text-sm">
      <h3 className="mb-2 font-medium text-slate-700">Allergen Summary</h3>
      {labelPreview.data?.allergens?.length ? (
       <div className="flex flex-wrap gap-2">
        {labelPreview.data.allergens.map((allergen) => (
         <span key={allergen} className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">
          {allergen}
         </span>
        ))}
       </div>
      ) : (
       <p className="text-slate-500">No allergens detected in linked ingredients.</p>
      )}
     </div>
    <div className="md:col-span-2 rounded border border-slate-200 bg-white p-4 text-sm">
      <h3 className="mb-3 font-medium text-slate-700">Composition</h3>
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
         {(labelPreview.data?.composition ?? []).map((row, index) => (
          <tr key={`${row.code}-${index}`} className="border-b border-slate-100">
           <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.code || "—"}</td>
           <td className="px-3 py-2">{row.name}</td>
           <td className="px-3 py-2 text-right">{typeof row.percentage === "number" ? row.percentage.toFixed(2) : "—"}</td>
          </tr>
         ))}
         {labelPreview.data?.composition?.length ? null : (
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
     <div className="md:col-span-2 rounded border border-slate-200 bg-white p-4 text-sm">
      <h3 className="mb-3 font-medium text-slate-700">Nutrition Panel</h3>
      {labelPreview.data?.nutrition?.length ? (
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
    <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
     <p className="mb-2 font-medium">Formulation Version History</p>
     {history.data?.history?.length ? (
      <div className="space-y-2">
       {history.data.history.map((entry) => (
        <Link
         key={entry.id}
         to={`/formulas/${entry.id}`}
         className={`block rounded border px-3 py-2 ${
          entry.id === formulaId ? "border-primary bg-white" : "border-slate-200 bg-white hover:border-primary"
         }`}
        >
         <div className="flex items-center justify-between text-sm">
          <span className="font-mono">{entry.formulaCode} v{entry.version}</span>
          <span className="text-slate-500">{entry.revisionLabel}</span>
         </div>
         <div className="text-xs text-slate-500">Status: {entry.status}</div>
        </Link>
       ))}
      </div>
     ) : (
      <p className="text-slate-500">No previous versions.</p>
     )}
    </div>
   )}
  </div>
 );
}
