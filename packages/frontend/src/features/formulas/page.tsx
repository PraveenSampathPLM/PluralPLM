import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link, useSearchParams } from "react-router-dom";
import { ObjectActionsMenu, type ObjectActionKey } from "@/components/object-actions-menu";
import { useContainerStore } from "@/store/container.store";
import { STANDARD_UOMS } from "@/lib/uom";
import { EntityIcon } from "@/components/entity-icon";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "sonner";

type RecipeType = "FORMULA_RECIPE" | "FINISHED_GOOD_RECIPE";
type InputSourceType = "ITEM" | "FORMULA";

interface FormulaIngredient {
 itemId?: string;
 inputFormulaId?: string;
 quantity: number;
 uom: string;
 percentage?: number;
 additionSequence?: number;
 item?: { itemCode: string; name: string };
 inputFormula?: { formulaCode: string; version: number; name: string };
}

interface Formula {
 id: string;
 formulaCode: string;
 version: number;
 revisionLabel: string;
 name: string;
 status: string;
 recipeType: RecipeType;
 outputItem?: { id: string; itemCode: string; name: string; itemType: string } | null;
 updatedAt: string;
 ingredients?: FormulaIngredient[];
}

interface FormulaResponse {
 data: Formula[];
 total: number;
 page: number;
 pageSize: number;
}
interface FormulaConfigResponse {
 listColumns: { FORMULA: string[] };
}

interface UomResponse {
 data: Array<{ value: string; label: string; category: string }>;
}

interface FormulaLinksResponse {
 formula: {
  id: string;
  formulaCode: string;
  version: number;
  recipeType: RecipeType;
  outputItem?: { id: string; itemCode: string; name: string; itemType: string } | null;
  name: string;
  status: string;
  ingredients: Array<{
   id: string;
   quantity: number;
   uom: string;
   item?: { itemCode: string; name: string };
   inputFormula?: { formulaCode: string; version: number; name: string };
  }>;
 };
 boms: Array<{ id: string; bomCode: string; version: number; type: string; lines: Array<{ id: string }> }>;
 specifications: Array<{ id: string; specType: string; attribute: string; minValue?: number | null; maxValue?: number | null; value?: string | null; uom?: string | null }>;
 relatedChanges: Array<{ id: string; crNumber: string; title: string; status: string }>;
 workflows: Array<{ id: string; currentState: string }>;
}

interface IngredientRow {
 sourceType: InputSourceType;
 sourceId: string;
 quantity: string;
 uom: string;
 percentage: string;
 additionSequence: string;
}
interface ContainerOption {
 id: string;
 code: string;
 name: string;
}
interface ItemOption {
 id: string;
 name: string;
 itemCode: string;
 itemType: "RAW_MATERIAL" | "INTERMEDIATE" | "FINISHED_GOOD" | "PACKAGING";
}

export function FormulasPage(): JSX.Element {
 const currentUserRole = (JSON.parse(localStorage.getItem("plm_user") || "{}") as { role?: string }).role ?? "";
 const isAdmin = ["System Admin", "PLM Admin", "Container Admin"].includes(currentUserRole);
 const { selectedContainerId } = useContainerStore();
 const queryClient = useQueryClient();
 const [searchParams] = useSearchParams();
 const fromNpdProjectId = searchParams.get("fromNpdProjectId") ?? "";
 const fromNpdProjectCode = searchParams.get("fromNpdProjectCode") ?? "";
 const fromNpdProjectName = searchParams.get("fromNpdProjectName") ?? "";
 const [createOpen, setCreateOpen] = useState(false);
 const createButtonRef = useRef<HTMLButtonElement | null>(null);
 const createPanelRef = useRef<HTMLDivElement | null>(null);
 const [selectedFormulaId, setSelectedFormulaId] = useState<string>("");
 const [search, setSearch] = useState("");
 const [page, setPage] = useState(1);
 const [form, setForm] = useState({
  formulaCode: "",
  version: "1",
  recipeType: "FORMULA_RECIPE" as RecipeType,
  outputItemId: "",
  name: "",
  batchSize: "100",
  batchUom: "kg",
  containerId: selectedContainerId
 });
 const [ingredients, setIngredients] = useState<IngredientRow[]>([
  { sourceType: "ITEM", sourceId: "", quantity: "", uom: "kg", percentage: "", additionSequence: "1" }
 ]);

 // Auto-open create panel when arriving from an NPD project
 useEffect(() => {
  if (fromNpdProjectId) {
   setCreateOpen(true);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [fromNpdProjectId]);

 const items = useQuery({
  queryKey: ["formula-item-options"],
  queryFn: async () =>
   (await api.get<{ data: ItemOption[] }>("/items", { params: { pageSize: 500 } })).data
 });
 const containers = useQuery({
  queryKey: ["formula-container-options"],
  queryFn: async () => (await api.get<{ data: ContainerOption[] }>("/containers")).data
 });

 const nextFormula = useQuery({
  queryKey: ["next-formula-number"],
  queryFn: async () => (await api.get<{ value: string }>("/config/next-number/FORMULA")).data
 });

 const { data, isLoading } = useQuery({
  queryKey: ["formulas", search, page, selectedContainerId],
  queryFn: async () =>
   (
    await api.get<FormulaResponse>("/formulas", {
     params: { ...(selectedContainerId ? { containerId: selectedContainerId } : {}), search, page, pageSize: 10 }
    })
   ).data
 });
 const config = useQuery({
  queryKey: ["formula-config"],
  queryFn: async () => (await api.get<FormulaConfigResponse>("/config")).data
 });
 const uomsQuery = useQuery({
  queryKey: ["config-uoms"],
  queryFn: async () => (await api.get<UomResponse>("/config/uoms")).data,
  retry: false
 });

 const formulaInputs = useMemo(
  () => (data?.data ?? []).filter((recipe) => recipe.recipeType === "FORMULA_RECIPE"),
  [data]
 );

 const finishedGoods = useMemo(
  () => (items.data?.data ?? []).filter((item) => item.itemType === "FINISHED_GOOD"),
  [items.data?.data]
 );

 const inputItemOptions = useMemo(() => {
  const base = items.data?.data ?? [];
  if (form.recipeType === "FORMULA_RECIPE") {
   return base.filter((item) => item.itemType === "RAW_MATERIAL" || item.itemType === "INTERMEDIATE");
  }
  return base.filter((item) => item.itemType === "PACKAGING");
 }, [items.data?.data, form.recipeType]);

 const selectedFormula = useQuery({
  queryKey: ["formula-details", selectedFormulaId],
  queryFn: async () => (await api.get<Formula>(`/formulas/${selectedFormulaId}`)).data,
  enabled: Boolean(selectedFormulaId)
 });

 const formulaLinks = useQuery({
  queryKey: ["formula-links", selectedFormulaId],
  queryFn: async () => (await api.get<FormulaLinksResponse>(`/formulas/${selectedFormulaId}/links`)).data,
  enabled: Boolean(selectedFormulaId)
 });

 const createFormula = useMutation({
  mutationFn: async () => {
   if (!selectedContainerId) {
    throw new Error("Select a container before creating formulations.");
   }
   const ingredientData = ingredients
    .filter((row) => row.sourceId && row.quantity)
    .map((row, index) => ({
     ...(row.sourceType === "ITEM" ? { itemId: row.sourceId } : { inputFormulaId: row.sourceId }),
     quantity: Number(row.quantity),
     uom: row.uom || "kg",
     ...(row.percentage ? { percentage: Number(row.percentage) } : {}),
     additionSequence: row.additionSequence ? Number(row.additionSequence) : index + 1
    }));

   if (ingredientData.length === 0) {
    throw new Error("Add at least one input row with source and quantity");
   }
   if (form.recipeType === "FINISHED_GOOD_RECIPE" && !form.outputItemId) {
    throw new Error("Finished Good requires an output finished good item");
   }

   const createdFormula = (await api.post<{ id: string; formulaCode: string }>("/formulas", {
    formulaCode: form.formulaCode || undefined,
    version: Number(form.version),
    recipeType: form.recipeType,
    outputItemId: form.recipeType === "FINISHED_GOOD_RECIPE" ? form.outputItemId : undefined,
    name: form.name,
    batchSize: Number(form.batchSize),
    batchUom: form.batchUom,
    containerId: selectedContainerId,
    status: "IN_WORK",
    ingredients: ingredientData
   })).data;
   return createdFormula;
  },
  onSuccess: async (createdFormula) => {
   toast.success("Formulation structure created successfully.");
   // If arriving from an NPD project, auto-link this formula back to the project
   if (fromNpdProjectId) {
    try {
     await api.patch(`/npd/projects/${fromNpdProjectId}`, { formulaId: createdFormula.id });
     toast.success(`Formula linked to NPD project ${fromNpdProjectCode}`);
     await queryClient.invalidateQueries({ queryKey: ["npd-project", fromNpdProjectId] });
    } catch {
     toast.error("Formula created but failed to link to NPD project — link it manually.");
    }
   }
   setForm({
    formulaCode: "",
    version: "1",
    recipeType: "FORMULA_RECIPE",
    outputItemId: "",
    name: "",
    batchSize: "100",
    batchUom: "kg",
    containerId: selectedContainerId
   });
   setIngredients([{ sourceType: "ITEM", sourceId: "", quantity: "", uom: "kg", percentage: "", additionSequence: "1" }]);
   await queryClient.invalidateQueries({ queryKey: ["formulas"] });
   await queryClient.invalidateQueries({ queryKey: ["next-formula-number"] });
  },
  onError: (error) => {
   toast.error(error instanceof Error ? error.message : "Create failed");
  }
 });

 async function runFormulaAction(formula: Formula, action: ObjectActionKey): Promise<void> {
  try {
   if (action === "checkout") {
    await api.post(`/formulas/${formula.id}/check-out`);
    toast.success(`Formulation ${formula.formulaCode} checked out.`);
   } else if (action === "checkin") {
    await api.post(`/formulas/${formula.id}/check-in`);
    toast.success(`Formulation ${formula.formulaCode} checked in.`);
   } else if (action === "copy") {
    await api.post(`/formulas/${formula.id}/copy`);
    toast.success(`Copy created for ${formula.formulaCode}.`);
   } else if (action === "revise") {
    await api.post(`/formulas/${formula.id}/revise`);
    toast.success(`Revision created for ${formula.formulaCode}.`);
   } else if (action === "delete") {
    let usageWarning = "";
    try {
      const links = await api.get<{ ingredients: unknown[]; fgUsages: unknown[] }>(`/formulas/${formula.id}/links`);
      const ingredientCount = links.data?.ingredients?.length ?? 0;
      const fgCount = links.data?.fgUsages?.length ?? 0;
      if (ingredientCount > 0 || fgCount > 0) {
        usageWarning = `\n\nWarning: This formula has ${ingredientCount} ingredient(s) and is linked to ${fgCount} FG structure(s). Deleting it may break those records.`;
      }
    } catch { /* ignore */ }
    if (!window.confirm(`Delete recipe ${formula.formulaCode} v${formula.version}?${usageWarning}`)) {
     return;
    }
    await api.delete(`/formulas/${formula.id}`);
    if (selectedFormulaId === formula.id) {
     setSelectedFormulaId("");
    }
    toast.success(`Formulation ${formula.formulaCode} deleted.`);
   }
   await queryClient.invalidateQueries({ queryKey: ["formulas"] });
   await queryClient.invalidateQueries({ queryKey: ["next-formula-number"] });
  } catch (error) {
   toast.error(error instanceof Error ? error.message : "Action failed");
  }
 }

 const formulaColumnDefs: Record<string, { label: string; render: (formula: Formula) => ReactNode }> = {
  formulaCode: { label: "Formulation Code", render: (formula) => formula.formulaCode },
  revisionLabel: { label: "Revision", render: (formula) => formula.revisionLabel ?? "1.1" },
  name: { label: "Name", render: (formula) => formula.name },
  recipeType: {
   label: "Formulation Type",
   render: (formula) => (formula.recipeType === "FORMULA_RECIPE" ? "Formula" : "Finished Good")
  },
  output: {
   label: "Output",
   render: (formula) =>
    formula.recipeType === "FINISHED_GOOD_RECIPE"
     ? `${formula.outputItem?.itemCode ?? "N/A"} - ${formula.outputItem?.name ?? "Unassigned"}`
     : "Formula"
  },
  version: { label: "Version", render: (formula) => String(formula.version) },
  status: { label: "Status", render: (formula) => <StatusBadge status={formula.status} /> },
  updatedAt: { label: "Updated", render: (formula) => new Date(formula.updatedAt).toLocaleDateString() }
 };
 const configuredColumns = (config.data?.listColumns?.FORMULA ?? ["formulaCode", "revisionLabel", "name", "recipeType", "status"]).filter(
  (key) => Boolean(formulaColumnDefs[key])
 );

 function updateIngredient(index: number, patch: Partial<IngredientRow>): void {
  setIngredients((previous) => previous.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
 }

 function addIngredientRow(): void {
  setIngredients((previous) => [
   ...previous,
   { sourceType: "ITEM", sourceId: "", quantity: "", uom: "kg", percentage: "", additionSequence: String(previous.length + 1) }
  ]);
 }

 function removeIngredientRow(index: number): void {
  setIngredients((previous) => (previous.length === 1 ? previous : previous.filter((_, rowIndex) => rowIndex !== index)));
 }

 useEffect(() => {
  if (!createOpen) {
   return;
  }
  const onPointerDown = (event: MouseEvent) => {
   const target = event.target as Node | null;
   if (!target) {
    return;
   }
   if (createPanelRef.current?.contains(target)) {
    return;
   }
   if (createButtonRef.current?.contains(target)) {
    return;
   }
   setCreateOpen(false);
  };
  const onEscape = (event: KeyboardEvent) => {
   if (event.key === "Escape") {
    setCreateOpen(false);
    setForm({ formulaCode: "", version: "1", recipeType: "FORMULA_RECIPE", outputItemId: "", name: "", batchSize: "100", batchUom: "kg", containerId: selectedContainerId });
    setIngredients([{ sourceType: "ITEM", sourceId: "", quantity: "", uom: "kg", percentage: "", additionSequence: "1" }]);
   }
  };
  document.addEventListener("mousedown", onPointerDown);
  document.addEventListener("keydown", onEscape);
  return () => {
   document.removeEventListener("mousedown", onPointerDown);
   document.removeEventListener("keydown", onEscape);
  };
 }, [createOpen]);

 return (
  <div className="space-y-4 rounded-xl bg-white p-4">
   <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
    <button
     ref={createButtonRef}
     type="button"
     onClick={() => setCreateOpen((prev) => !prev)}
     className="w-full rounded-lg border border-primary bg-primary px-4 py-3 text-left text-sm font-semibold text-white shadow-sm transition hover:bg-[#174766]"
    >
     + Create Formulation
    </button>
    <p className="mt-2 text-xs text-slate-500">Auto-number preview: {nextFormula.data?.value ?? "Loading..."}</p>
   </div>

   {createOpen ? (
   <div ref={createPanelRef} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
    <h3 className="mb-1 font-heading text-lg">Create Formulation</h3>
    {fromNpdProjectId && (
     <div className="mb-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
      <span className="text-base">🔗</span>
      <span>Creating Formula for NPD Project <strong>{fromNpdProjectCode}</strong> — {fromNpdProjectName}. After creation it will be automatically linked.</span>
     </div>
    )}
    <p className="mb-3 text-xs text-slate-500">
     Leave Formulation Code blank for auto-number: {nextFormula.data?.value ?? "Loading..."}
    </p>

    <div className="grid gap-3 md:grid-cols-6">
     <input
      value={form.formulaCode}
      onChange={(event) => setForm({ ...form, formulaCode: event.target.value })}
      placeholder="Formulation Code (optional)"
      className="rounded border border-slate-300 px-3 py-2 text-sm"
     />
     <input
      value={form.version}
      onChange={(event) => setForm({ ...form, version: event.target.value })}
      placeholder="Version"
      className="rounded border border-slate-300 px-3 py-2 text-sm"
     />
     <select
      value={form.recipeType}
      onChange={(event) =>
       setForm({
        ...form,
        recipeType: event.target.value as RecipeType,
        outputItemId: event.target.value === "FINISHED_GOOD_RECIPE" ? form.outputItemId : ""
       })
      }
      className="rounded border border-slate-300 px-3 py-2 text-sm"
     >
      <option value="FORMULA_RECIPE">Formula</option>
      <option value="FINISHED_GOOD_RECIPE">Finished Good</option>
     </select>
     <input
      value={form.name}
      onChange={(event) => setForm({ ...form, name: event.target.value })}
      placeholder="Formulation Name"
      className="rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2"
     />
     <input
      value={form.batchSize}
      onChange={(event) => setForm({ ...form, batchSize: event.target.value })}
      placeholder="Batch Size"
      className="rounded border border-slate-300 px-3 py-2 text-sm"
     />
     <select
      value={form.batchUom}
      onChange={(event) => setForm({ ...form, batchUom: event.target.value })}
      className="rounded border border-slate-300 px-3 py-2 text-sm"
     >
      {(uomsQuery.data?.data ?? STANDARD_UOMS).map((uom) => (
       <option key={uom.value} value={uom.value}>
        {uom.label}
       </option>
      ))}
     </select>
     <select
      value={form.outputItemId}
      onChange={(event) => setForm({ ...form, outputItemId: event.target.value })}
      disabled={form.recipeType !== "FINISHED_GOOD_RECIPE"}
      className="rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
     >
      <option value="">Output Finished Good</option>
      {finishedGoods.map((item) => (
       <option key={item.id} value={item.id}>
        {item.itemCode} - {item.name}
       </option>
      ))}
     </select>
     <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 md:col-span-2">
      Active Container: {containers.data?.data.find((c) => c.id === selectedContainerId)?.code ?? "All Accessible"}
     </div>
    </div>

    <div className="mt-4 overflow-x-auto rounded border border-slate-200 bg-white">
     <table className="w-full min-w-[980px] text-left text-sm">
      <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
       <tr>
        <th className="px-2 py-2">Source Type</th>
        <th className="px-2 py-2">Input Source</th>
        <th className="px-2 py-2">Quantity</th>
        <th className="px-2 py-2">UOM</th>
        <th className="px-2 py-2">%</th>
        <th className="px-2 py-2">Addition Seq</th>
        <th className="px-2 py-2">Action</th>
       </tr>
      </thead>
      <tbody>
       {ingredients.map((row, index) => (
        <tr key={`ing-${index}`} className="border-b border-slate-100">
         <td className="px-2 py-2">
          <select
           value={row.sourceType}
           onChange={(event) =>
            updateIngredient(index, {
             sourceType: event.target.value as InputSourceType,
             sourceId: ""
            })
           }
           className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          >
           <option value="ITEM">Item</option>
           <option value="FORMULA">Formula</option>
          </select>
         </td>
         <td className="px-2 py-2">
          <select
           value={row.sourceId}
           onChange={(event) => updateIngredient(index, { sourceId: event.target.value })}
           className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          >
           <option value="">Select {row.sourceType === "ITEM" ? "Item" : "Formula"}</option>
           {row.sourceType === "ITEM"
            ? inputItemOptions.map((item) => (
              <option key={item.id} value={item.id}>
               {item.itemCode} - {item.name}
              </option>
             ))
            : formulaInputs.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
               {recipe.formulaCode} v{recipe.version} - {recipe.name}
              </option>
             ))}
          </select>
         </td>
         <td className="px-2 py-2">
          <input
           value={row.quantity}
           onChange={(event) => updateIngredient(index, { quantity: event.target.value })}
           className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
         </td>
         <td className="px-2 py-2">
          <select
           value={row.uom}
           onChange={(event) => updateIngredient(index, { uom: event.target.value })}
           className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
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
           value={row.percentage}
           onChange={(event) => updateIngredient(index, { percentage: event.target.value })}
           className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
         </td>
         <td className="px-2 py-2">
          <input
           value={row.additionSequence}
           onChange={(event) => updateIngredient(index, { additionSequence: event.target.value })}
           className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
         </td>
         <td className="px-2 py-2">
          <button type="button" onClick={() => removeIngredientRow(index)} className="rounded border border-slate-300 px-2 py-1 text-xs">
           Remove
          </button>
         </td>
        </tr>
       ))}
      </tbody>
     </table>
    </div>

    <div className="mt-3 flex items-center gap-3">
     <button type="button" onClick={addIngredientRow} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
      Add Input Row
     </button>
     <button
      type="button"
      onClick={() => createFormula.mutate()}
      disabled={!form.name || createFormula.isPending}
      className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
     >
      {createFormula.isPending ? "Creating..." : "Create Formulation"}
     </button>
    </div>
   </div>
   ) : null}

   <div className="flex items-center justify-between">
    <h2 className="font-heading text-xl">Formulation Management</h2>
    <input
     value={search}
     onChange={(e) => { setSearch(e.target.value); setPage(1); }}
     placeholder="Search formulations"
     className="w-64 rounded border border-slate-300 px-3 py-2 text-sm"
    />
   </div>
   {isLoading ? (
    <p>Loading formulations...</p>
   ) : (
    <>
    <table className="w-full text-left text-sm">
     <thead>
      <tr className="border-b border-slate-200 text-slate-500">
        <th className="w-10 py-2"> </th>
       {configuredColumns.map((columnKey) => (
        <th key={columnKey} className="py-2">
         {formulaColumnDefs[columnKey]?.label ?? columnKey}
        </th>
       ))}
       <th className="py-2">Inputs</th>
       <th className="py-2">Actions</th>
      </tr>
     </thead>
     <tbody>
      {(data?.data ?? []).map((formula) => (
       <tr key={formula.id} className="border-b border-slate-100">
        <td className="py-2 text-slate-500">
          <EntityIcon kind="formula" />
        </td>
        {configuredColumns.map((columnKey) => {
         const value = formulaColumnDefs[columnKey]?.render(formula) ?? "";
         const isCode = columnKey === "formulaCode";
         return (
          <td
           key={`${formula.id}-${columnKey}`}
           className={`py-2 ${isCode ? "font-mono" : ""}`}
          >
           {isCode ? (
            <Link to={`/formulas/${formula.id}`} className="text-primary hover:underline">
             {value}
            </Link>
           ) : (
            value
           )}
          </td>
         );
        })}
        <td className="py-2">{formula.ingredients?.length ?? 0}</td>
        <td className="py-2">
         <button
          type="button"
          onClick={() => setSelectedFormulaId(formula.id)}
          className="rounded border border-slate-300 px-2 py-1 text-xs"
         >
          Open Structure
         </button>
         <Link to={`/formulas/${formula.id}`} className="ml-2 rounded border border-slate-300 px-2 py-1 text-xs">
          Open
         </Link>
         <span className="ml-2 inline-block">
          <ObjectActionsMenu
            onAction={(action) => void runFormulaAction(formula, action)}
            actions={[
              { key: "checkout", label: "Check Out" },
              { key: "checkin", label: "Check In" },
              { key: "revise", label: "Revise" },
              { key: "copy", label: "Save as Copy" },
              ...(isAdmin ? [{ key: "delete" as const, label: "Delete", danger: true }] : [])
            ]}
          />
         </span>
        </td>
       </tr>
      ))}
     </tbody>
    </table>
    {(data?.data ?? []).length === 0 && !isLoading ? (
     <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
      <p className="font-medium">No formulations found</p>
      <p className="mt-1 text-xs">{search ? "Try a different search term" : "Click \"+ Create Formulation\" above to get started"}</p>
     </div>
    ) : null}
    {(data?.total ?? 0) > (data?.pageSize ?? 10) ? (
     <div className="flex items-center justify-between text-sm text-slate-600">
      <p>Total: {data?.total ?? 0} records</p>
      <div className="flex items-center gap-2">
       <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-60">Prev</button>
       <span>Page {page} / {Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 10)))}</span>
       <button type="button" disabled={page >= Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 10)))} onClick={() => setPage((p) => p + 1)} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-60">Next</button>
      </div>
     </div>
    ) : (
     <p className="text-sm text-slate-500">Total: {data?.total ?? 0} records</p>
    )}
    </>
   )}

   {selectedFormulaId ? (
    <div className="fixed inset-0 z-40 flex">
     <button type="button" className="h-full flex-1 bg-black/30" onClick={() => setSelectedFormulaId("")} aria-label="Close panel" />
     <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
       <h3 className="font-heading text-lg">Formulation Panel</h3>
       <button type="button" onClick={() => setSelectedFormulaId("")} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">
        Close
       </button>
      </div>

      <div className="space-y-3">
       <div className="rounded border border-slate-200 bg-slate-50 p-3">
        <h4 className="mb-2 font-medium">Structure</h4>
        {selectedFormula.isLoading ? (
         <p>Loading structure...</p>
        ) : (
         <div>
          <p className="text-sm text-slate-600">
           {selectedFormula.data?.formulaCode} v{selectedFormula.data?.version} - {selectedFormula.data?.name}
          </p>
          <div className="mt-2 text-xs text-slate-500">
           Type: {selectedFormula.data?.recipeType === "FORMULA_RECIPE" ? "Formula" : "Finished Good"}
           {selectedFormula.data?.outputItem ? ` | Output: ${selectedFormula.data.outputItem.itemCode} - ${selectedFormula.data.outputItem.name}` : ""}
          </div>
          <div className="mt-3 overflow-x-auto rounded border border-slate-200 bg-white">
           <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
             <tr>
              <th className="px-2 py-2">Input</th>
              <th className="px-2 py-2">Qty</th>
              <th className="px-2 py-2">UOM</th>
              <th className="px-2 py-2">%</th>
              <th className="px-2 py-2">Seq</th>
             </tr>
            </thead>
            <tbody>
             {selectedFormula.data?.ingredients?.map((ingredient, index) => (
              <tr key={`${ingredient.itemId ?? ingredient.inputFormulaId ?? index}`} className="border-b border-slate-100">
               <td className="px-2 py-2">
                {ingredient.item
                 ? `${ingredient.item.itemCode} - ${ingredient.item.name}`
                 : ingredient.inputFormula
                  ? `${ingredient.inputFormula.formulaCode} v${ingredient.inputFormula.version} - ${ingredient.inputFormula.name}`
                  : "Unknown"}
               </td>
               <td className="px-2 py-2">{ingredient.quantity}</td>
               <td className="px-2 py-2">{ingredient.uom}</td>
               <td className="px-2 py-2">{ingredient.percentage ?? "N/A"}</td>
               <td className="px-2 py-2">{ingredient.additionSequence ?? index + 1}</td>
              </tr>
             ))}
            </tbody>
           </table>
          </div>
         </div>
        )}
       </div>

       <div className="rounded border border-slate-200 bg-slate-50 p-3">
        <h4 className="mb-2 font-medium">Linkage</h4>
        {formulaLinks.isLoading ? (
         <p>Loading linkage...</p>
        ) : (
         <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded border border-slate-200 bg-white p-3 text-sm">
           <p className="mb-1 font-medium">Linked BOMs ({formulaLinks.data?.boms.length ?? 0})</p>
           {formulaLinks.data?.boms.map((bom) => (
            <Link key={bom.id} to={`/fg/${bom.id}`} className="block text-primary hover:underline">
             {bom.bomCode} v{bom.version} ({bom.type}){Array.isArray(bom.lines) ? ` - Lines: ${bom.lines.length}` : ""}
            </Link>
           ))}
          </div>
          <div className="rounded border border-slate-200 bg-white p-3 text-sm">
           <p className="mb-1 font-medium">Specifications ({formulaLinks.data?.specifications.length ?? 0})</p>
           {formulaLinks.data?.specifications.map((spec) => (
            <p key={spec.id} className="text-slate-600">
             {spec.specType}: {spec.attribute} [{spec.minValue ?? spec.value ?? "N/A"} - {spec.maxValue ?? "N/A"} {spec.uom ?? ""}]
            </p>
           ))}
          </div>
          <div className="rounded border border-slate-200 bg-white p-3 text-sm">
           <p className="mb-1 font-medium">Change Requests ({formulaLinks.data?.relatedChanges.length ?? 0})</p>
           {formulaLinks.data?.relatedChanges.map((change) => (
            <Link key={change.id} to={`/changes/${change.id}`} className="block text-primary hover:underline">
             {change.crNumber}: {change.title} ({change.status})
            </Link>
           ))}
          </div>
          <div className="rounded border border-slate-200 bg-white p-3 text-sm">
           <p className="mb-1 font-medium">Workflows ({formulaLinks.data?.workflows.length ?? 0})</p>
           {formulaLinks.data?.workflows.map((workflow) => (
            <p key={workflow.id} className="text-slate-600">
             {workflow.currentState}
            </p>
           ))}
          </div>
         </div>
        )}
       </div>
      </div>
     </div>
    </div>
   ) : null}
  </div>
 );
}
