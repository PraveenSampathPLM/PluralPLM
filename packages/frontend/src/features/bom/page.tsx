import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { ObjectActionsMenu, type ObjectActionKey } from "@/components/object-actions-menu";
import { useContainerStore } from "@/store/container.store";
import { STANDARD_UOMS } from "@/lib/uom";
import { EntityIcon } from "@/components/entity-icon";

interface BomLine {
  lineNumber?: number;
  itemId?: string;
  inputFormulaId?: string;
  quantity: number;
  uom: string;
  scrapFactor?: number;
  phaseStep?: string;
  operationStep?: string;
  referenceDesignator?: string;
  item?: { itemCode: string; name: string };
  inputFormula?: { id: string; formulaCode: string; version: number; name: string };
}

interface BomRecord {
  id: string;
  bomCode: string;
  version: number;
  revisionLabel: string;
  status?: string;
  type: string;
  bomType?: "FG_BOM" | "FML_BOM";
  parentItem?: { id: string; itemCode: string; name: string } | null;
  formulaId?: string | null;
  effectiveDate: string | null;
  updatedAt: string;
  lines?: BomLine[];
}

interface BomListResponse {
  data: BomRecord[];
  total: number;
  page: number;
  pageSize: number;
}
interface BomConfigResponse {
  listColumns: { BOM: string[] };
}

interface UomResponse {
  data: Array<{ value: string; label: string; category: string }>;
}

interface BomLinksResponse {
  bom: {
    id: string;
    bomCode: string;
    version: number;
    type: string;
    bomType?: "FG_BOM" | "FML_BOM";
    parentItem?: { id: string; itemCode: string; name: string; itemType: string } | null;
    formula?: { id: string; formulaCode: string; version: number; name: string; status: string } | null;
    lines: Array<{ id: string; item?: { itemCode: string; name: string } | null; inputFormula?: { id: string; formulaCode: string; version: number; name: string } | null }>;
  };
  relatedChanges: Array<{ id: string; crNumber: string; title: string; status: string }>;
  workflows: Array<{ id: string; currentState: string }>;
  formulaSpecifications: Array<{ id: string; specType: string; attribute: string; value?: string | null; minValue?: number | null; maxValue?: number | null; uom?: string | null }>;
  lineItemSpecifications: Array<{ id: string; itemId: string | null; specType: string; attribute: string; value?: string | null; minValue?: number | null; maxValue?: number | null; uom?: string | null }>;
}

interface BomLineRow {
  lineNumber: string;
  sourceType: "ITEM" | "FORMULA";
  sourceId: string;
  quantity: string;
  uom: string;
  scrapFactor: string;
  phaseStep: string;
  operationStep: string;
  referenceDesignator: string;
}
interface ContainerOption {
  id: string;
  code: string;
  name: string;
}

export function BomPage(): JSX.Element {
  const { selectedContainerId } = useContainerStore();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [selectedBomId, setSelectedBomId] = useState<string>("");
  const [form, setForm] = useState({
    version: "1",
    bomType: "FML_BOM",
    parentItemId: "",
    formulaId: "",
    containerId: selectedContainerId,
    type: "PRODUCTION",
    effectiveDate: ""
  });
  const [lines, setLines] = useState<BomLineRow[]>([
    {
      lineNumber: "10",
      sourceType: "ITEM",
      sourceId: "",
      quantity: "",
      uom: "kg",
      scrapFactor: "",
      phaseStep: "",
      operationStep: "",
      referenceDesignator: ""
    }
  ]);

  const formulas = useQuery({
    queryKey: ["bom-formula-options"],
    queryFn: async () =>
      (await api.get<{ data: Array<{ id: string; formulaCode: string; version: number }> }>("/formulas", { params: { pageSize: 200 } })).data
  });
  const containers = useQuery({
    queryKey: ["bom-container-options"],
    queryFn: async () => (await api.get<{ data: ContainerOption[] }>("/containers")).data
  });

  const items = useQuery({
    queryKey: ["bom-item-options"],
    queryFn: async () =>
      (await api.get<{ data: Array<{ id: string; itemCode: string; name: string; itemType: string }> }>("/items", { params: { pageSize: 200 } })).data
  });

  const { data, isLoading } = useQuery({
    queryKey: ["bom", selectedContainerId],
    queryFn: async () =>
      (
        await api.get<BomListResponse>("/bom", {
          params: { ...(selectedContainerId ? { containerId: selectedContainerId } : {}) }
        })
      ).data
  });
  const config = useQuery({
    queryKey: ["bom-config"],
    queryFn: async () => (await api.get<BomConfigResponse>("/config")).data
  });
  const uomsQuery = useQuery({
    queryKey: ["config-uoms"],
    queryFn: async () => (await api.get<UomResponse>("/config/uoms")).data,
    retry: false
  });

  const filteredItemOptions =
    form.bomType === "FG_BOM"
      ? items.data?.data.filter((item) => item.itemType === "PACKAGING") ?? []
      : items.data?.data.filter((item) => item.itemType === "RAW_MATERIAL" || item.itemType === "INTERMEDIATE") ?? [];

  const filteredFormulaOptions = formulas.data?.data.filter((formula) => formula.recipeType === "FORMULA_RECIPE") ?? [];

  const selectedBom = useQuery({
    queryKey: ["bom-details", selectedBomId],
    queryFn: async () => (await api.get<BomRecord>(`/bom/${selectedBomId}`)).data,
    enabled: Boolean(selectedBomId)
  });

  const bomLinks = useQuery({
    queryKey: ["bom-links", selectedBomId],
    queryFn: async () => (await api.get<BomLinksResponse>(`/bom/${selectedBomId}/links`)).data,
    enabled: Boolean(selectedBomId)
  });

  const createBom = useMutation({
    mutationFn: async () => {
      const mappedLines = lines
        .filter((row) => row.sourceId && row.quantity)
        .map((row) => ({
          ...(row.lineNumber ? { lineNumber: Number(row.lineNumber) } : {}),
          ...(row.sourceType === "ITEM" ? { itemId: row.sourceId } : { inputFormulaId: row.sourceId }),
          quantity: Number(row.quantity),
          uom: row.uom || "kg",
          ...(row.scrapFactor ? { scrapFactor: Number(row.scrapFactor) } : {}),
          ...(row.phaseStep ? { phaseStep: row.phaseStep } : {}),
          ...(row.operationStep ? { operationStep: row.operationStep } : {}),
          ...(row.referenceDesignator ? { referenceDesignator: row.referenceDesignator } : {})
        }));

      if (mappedLines.length === 0) {
        throw new Error("Add at least one BOM line with item and quantity");
      }

      await api.post("/bom", {
        version: Number(form.version),
        bomType: form.bomType,
        parentItemId: form.bomType === "FG_BOM" ? form.parentItemId || undefined : undefined,
        formulaId: form.bomType === "FML_BOM" ? form.formulaId || undefined : undefined,
        containerId: selectedContainerId || form.containerId || undefined,
        type: form.type,
        effectiveDate: form.effectiveDate || undefined,
        lines: mappedLines
      });
    },
    onSuccess: async () => {
      setMessage("BOM structure created successfully.");
      setForm({ version: "1", bomType: "FML_BOM", parentItemId: "", formulaId: "", containerId: selectedContainerId, type: "PRODUCTION", effectiveDate: "" });
      setLines([
        {
          lineNumber: "10",
          sourceType: "ITEM",
          sourceId: "",
          quantity: "",
          uom: "kg",
          scrapFactor: "",
          phaseStep: "",
          operationStep: "",
          referenceDesignator: ""
        }
      ]);
      await queryClient.invalidateQueries({ queryKey: ["bom"] });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "Create failed");
    }
  });

  async function runBomAction(bom: BomRecord, action: ObjectActionKey): Promise<void> {
    try {
      if (action === "checkout") {
        await api.post(`/bom/${bom.id}/check-out`);
        setMessage(`BOM ${bom.bomCode} checked out.`);
      } else if (action === "checkin") {
        await api.post(`/bom/${bom.id}/check-in`);
        setMessage(`BOM ${bom.bomCode} checked in.`);
      } else if (action === "copy") {
        await api.post(`/bom/${bom.id}/copy`);
        setMessage(`Copy created for ${bom.bomCode}.`);
      } else if (action === "revise") {
        await api.post(`/bom/${bom.id}/revise`);
        setMessage(`Revision created for ${bom.bomCode}.`);
      } else if (action === "delete") {
        if (!window.confirm(`Delete BOM ${bom.bomCode} v${bom.version}?`)) {
          return;
        }
        await api.delete(`/bom/${bom.id}`);
        if (selectedBomId === bom.id) {
          setSelectedBomId("");
        }
        setMessage(`BOM ${bom.bomCode} deleted.`);
      }
      await queryClient.invalidateQueries({ queryKey: ["bom"] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    }
  }

  function renderStatusBadge(status?: string): ReactNode {
    const normalized = status ?? "DRAFT";
    const color =
      normalized === "DRAFT"
        ? "bg-slate-100 text-slate-700"
        : normalized === "IN_REVIEW"
          ? "bg-amber-100 text-amber-700"
          : normalized === "APPROVED"
            ? "bg-emerald-100 text-emerald-700"
            : normalized === "RELEASED"
              ? "bg-blue-100 text-blue-700"
              : "bg-rose-100 text-rose-700";
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{normalized}</span>;
  }

  const bomColumnDefs: Record<string, { label: string; render: (bom: BomRecord) => ReactNode }> = {
    bomCode: { label: "BOM Code", render: (bom) => bom.bomCode },
    revisionLabel: { label: "Revision", render: (bom) => bom.revisionLabel ?? "1.1" },
    type: { label: "Type", render: (bom) => (bom.bomType === "FG_BOM" ? "FG BOM" : "FML BOM") },
    parent: {
      label: "Parent",
      render: (bom) => (bom.bomType === "FG_BOM" ? `${bom.parentItem?.itemCode ?? "N/A"}` : bom.bomCode)
    },
    version: { label: "Version", render: (bom) => String(bom.version) },
    status: { label: "Status", render: (bom) => renderStatusBadge(bom.status) },
    effectiveDate: {
      label: "Effective Date",
      render: (bom) => (bom.effectiveDate ? new Date(bom.effectiveDate).toLocaleDateString() : "N/A")
    },
    updatedAt: { label: "Updated", render: (bom) => new Date(bom.updatedAt).toLocaleDateString() }
  };
  const configuredColumns = (config.data?.listColumns?.BOM ?? ["bomCode", "parent", "type", "status", "effectiveDate"]).filter((key) =>
    Boolean(bomColumnDefs[key])
  );

  function updateLine(index: number, patch: Partial<BomLineRow>): void {
    setLines((previous) => previous.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function addLineRow(): void {
    setLines((previous) => [
      ...previous,
      {
        lineNumber: String((previous.length + 1) * 10),
        sourceType: "ITEM",
        sourceId: "",
        quantity: "",
        uom: "kg",
        scrapFactor: "",
        phaseStep: "",
        operationStep: "",
        referenceDesignator: ""
      }
    ]);
  }

  function removeLineRow(index: number): void {
    setLines((previous) => (previous.length === 1 ? previous : previous.filter((_, rowIndex) => rowIndex !== index)));
  }

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-1 font-heading text-lg">Create BOM Structure</h3>

        <div className="grid gap-3 md:grid-cols-6">
          <input
            value={form.version}
            onChange={(event) => setForm({ ...form, version: event.target.value })}
            placeholder="Version"
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={form.bomType}
            onChange={(event) => setForm({ ...form, bomType: event.target.value, parentItemId: "", formulaId: "" })}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="FG_BOM">FG BOM</option>
            <option value="FML_BOM">FML BOM</option>
          </select>
          {form.bomType === "FG_BOM" ? (
            <select
              value={form.parentItemId}
              onChange={(event) => setForm({ ...form, parentItemId: event.target.value })}
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select Finished Good</option>
              {items.data?.data
                .filter((item) => item.itemType === "FINISHED_GOOD")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.itemCode} - {item.name}
                  </option>
                ))}
            </select>
          ) : (
            <select
              value={form.formulaId}
              onChange={(event) => setForm({ ...form, formulaId: event.target.value })}
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select Formula</option>
              {formulas.data?.data.map((formula) => (
                <option key={formula.id} value={formula.id}>
                  {formula.formulaCode} v{formula.version}
                </option>
              ))}
            </select>
          )}
          <select
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value })}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="PRODUCTION">Production</option>
            <option value="COSTING">Costing</option>
            <option value="PLANNING">Planning</option>
          </select>
          <input
            type="date"
            value={form.effectiveDate}
            onChange={(event) => setForm({ ...form, effectiveDate: event.target.value })}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 md:col-span-2">
            Active Container: {containers.data?.data.find((c) => c.id === selectedContainerId)?.code ?? "All Accessible"}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-2 py-2">Line #</th>
                <th className="px-2 py-2">Source Type</th>
                <th className="px-2 py-2">Source</th>
                <th className="px-2 py-2">Quantity</th>
                <th className="px-2 py-2">UOM</th>
                <th className="px-2 py-2">Scrap %</th>
                <th className="px-2 py-2">Phase Step</th>
                <th className="px-2 py-2">Operation Step</th>
                <th className="px-2 py-2">Ref Designator</th>
                <th className="px-2 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((row, index) => (
                <tr key={`line-${index}`} className="border-b border-slate-100">
                  <td className="px-2 py-2">
                    <input
                      value={row.lineNumber}
                      onChange={(event) => updateLine(index, { lineNumber: event.target.value })}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={row.sourceType}
                      onChange={(event) => updateLine(index, { sourceType: event.target.value as "ITEM" | "FORMULA", sourceId: "" })}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="ITEM">Item</option>
                      <option value="FORMULA">Formula</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={row.sourceId}
                      onChange={(event) => updateLine(index, { sourceId: event.target.value })}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="">Select {row.sourceType === "ITEM" ? "Item" : "Formula"}</option>
                      {row.sourceType === "ITEM"
                        ? filteredItemOptions.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.itemCode} - {item.name}
                            </option>
                          ))
                        : filteredFormulaOptions.map((formula) => (
                            <option key={formula.id} value={formula.id}>
                              {formula.formulaCode} v{formula.version}
                            </option>
                          ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={row.quantity}
                      onChange={(event) => updateLine(index, { quantity: event.target.value })}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={row.uom}
                      onChange={(event) => updateLine(index, { uom: event.target.value })}
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
                      value={row.scrapFactor}
                      onChange={(event) => updateLine(index, { scrapFactor: event.target.value })}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={row.phaseStep}
                      onChange={(event) => updateLine(index, { phaseStep: event.target.value })}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={row.operationStep}
                      onChange={(event) => updateLine(index, { operationStep: event.target.value })}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={row.referenceDesignator}
                      onChange={(event) => updateLine(index, { referenceDesignator: event.target.value })}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button type="button" onClick={() => removeLineRow(index)} className="rounded border border-slate-300 px-2 py-1 text-xs">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={addLineRow} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
            Add BOM Line
          </button>
          <button type="button" onClick={() => createBom.mutate()} disabled={createBom.isPending} className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {createBom.isPending ? "Creating..." : "Create BOM Structure"}
          </button>
        </div>

        {message ? <p className="mt-2 text-sm text-slate-700">{message}</p> : null}
      </div>

      <h2 className="mb-4 font-heading text-xl">BOM Management</h2>
      {isLoading ? (
        <p>Loading BOMs...</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="w-10 py-2"> </th>
              {configuredColumns.map((columnKey) => (
                <th key={columnKey} className="py-2">
                  {bomColumnDefs[columnKey]?.label ?? columnKey}
                </th>
              ))}
              <th className="py-2">Lines</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((bom) => (
              <tr key={bom.id} className="border-b border-slate-100">
                <td className="py-2 text-slate-500">
                  <EntityIcon kind="bom" />
                </td>
                {configuredColumns.map((columnKey) => {
                  const value = bomColumnDefs[columnKey]?.render(bom) ?? "";
                  const isCode = columnKey === "bomCode";
                  return (
                    <td
                      key={`${bom.id}-${columnKey}`}
                      className={`py-2 ${isCode ? "font-mono" : ""}`}
                    >
                      {isCode ? (
                        <Link to={`/bom/${bom.id}`} className="text-primary hover:underline">
                          {value}
                        </Link>
                      ) : (
                        value
                      )}
                    </td>
                  );
                })}
                <td className="py-2">{bom.lines?.length ?? 0}</td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => setSelectedBomId(bom.id)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    Open Structure
                  </button>
                  <Link to={`/bom/${bom.id}`} className="ml-2 rounded border border-slate-300 px-2 py-1 text-xs">
                    Open
                  </Link>
                  <span className="ml-2 inline-block">
                    <ObjectActionsMenu
                      onAction={(action) => void runBomAction(bom, action)}
                      actions={[
                        { key: "checkout", label: "Check Out", disabled: bom.status !== "DRAFT" },
                        { key: "checkin", label: "Check In", disabled: bom.status !== "IN_REVIEW" },
                        { key: "revise", label: "Revise" },
                        { key: "copy", label: "Copy" },
                        { key: "delete", label: "Delete", danger: true }
                      ]}
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedBomId ? (
        <div className="fixed inset-0 z-40 flex">
          <button type="button" className="h-full flex-1 bg-black/30" onClick={() => setSelectedBomId("")} aria-label="Close panel" />
          <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-heading text-lg">BOM Panel</h3>
              <button type="button" onClick={() => setSelectedBomId("")} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">
                Close
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded border border-slate-200 bg-slate-50 p-3">
                <h4 className="mb-2 font-medium">Structure</h4>
                {selectedBom.isLoading ? (
                  <p>Loading structure...</p>
                ) : (
                  <div>
                    <p className="text-sm text-slate-600">
                      {selectedBom.data?.bomCode} v{selectedBom.data?.version} - {selectedBom.data?.type}
                    </p>
                    <div className="mt-3 overflow-x-auto rounded border border-slate-200 bg-white">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-2 py-2">Line #</th>
                            <th className="px-2 py-2">Input</th>
                            <th className="px-2 py-2">Qty</th>
                            <th className="px-2 py-2">UOM</th>
                            <th className="px-2 py-2">Scrap</th>
                            <th className="px-2 py-2">Phase</th>
                            <th className="px-2 py-2">Operation</th>
                            <th className="px-2 py-2">Ref</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBom.data?.lines?.map((line, index) => (
                            <tr key={`${line.itemId ?? line.inputFormulaId ?? index}`} className="border-b border-slate-100">
                              <td className="px-2 py-2">{line.lineNumber ?? index + 1}</td>
                              <td className="px-2 py-2">
                                {line.inputFormula
                                  ? `${line.inputFormula.formulaCode} v${line.inputFormula.version} - ${line.inputFormula.name}`
                                  : `${line.item?.itemCode ?? "N/A"} - ${line.item?.name ?? ""}`}
                              </td>
                              <td className="px-2 py-2">{line.quantity}</td>
                              <td className="px-2 py-2">{line.uom}</td>
                              <td className="px-2 py-2">{line.scrapFactor ?? "N/A"}</td>
                              <td className="px-2 py-2">{line.phaseStep ?? "N/A"}</td>
                              <td className="px-2 py-2">{line.operationStep ?? "N/A"}</td>
                              <td className="px-2 py-2">{line.referenceDesignator ?? "N/A"}</td>
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
                {bomLinks.isLoading ? (
                  <p>Loading linkage...</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded border border-slate-200 bg-white p-3 text-sm">
                      <p className="mb-1 font-medium">Parent</p>
                      {bomLinks.data?.bom.bomType === "FG_BOM" ? (
                        bomLinks.data?.bom.parentItem ? (
                          <Link to={`/items/${bomLinks.data.bom.parentItem.id}`} className="text-primary hover:underline">
                            {bomLinks.data.bom.parentItem.itemCode} - {bomLinks.data.bom.parentItem.name}
                          </Link>
                        ) : (
                          <p className="text-slate-500">Unassigned FG</p>
                        )
                      ) : bomLinks.data?.bom.formula ? (
                        <Link to={`/formulas/${bomLinks.data.bom.formula.id}`} className="text-primary hover:underline">
                          {bomLinks.data.bom.formula.formulaCode} v{bomLinks.data.bom.formula.version} - {bomLinks.data.bom.formula.name}
                        </Link>
                      ) : (
                        <p className="text-slate-500">Unassigned Formula</p>
                      )}
                    </div>
                    <div className="rounded border border-slate-200 bg-white p-3 text-sm">
                      <p className="mb-1 font-medium">Change Requests ({bomLinks.data?.relatedChanges.length ?? 0})</p>
                      {bomLinks.data?.relatedChanges.map((change) => (
                        <Link key={change.id} to={`/changes/${change.id}`} className="block text-primary hover:underline">
                          {change.crNumber}: {change.title} ({change.status})
                        </Link>
                      ))}
                    </div>
                    <div className="rounded border border-slate-200 bg-white p-3 text-sm">
                      <p className="mb-1 font-medium">Formula Specs ({bomLinks.data?.formulaSpecifications.length ?? 0})</p>
                      {bomLinks.data?.formulaSpecifications.map((spec) => (
                        <p key={spec.id} className="text-slate-600">
                          {spec.specType}: {spec.attribute} [{spec.minValue ?? spec.value ?? "N/A"} - {spec.maxValue ?? "N/A"} {spec.uom ?? ""}]
                        </p>
                      ))}
                    </div>
                    <div className="rounded border border-slate-200 bg-white p-3 text-sm">
                      <p className="mb-1 font-medium">Line Item Specs ({bomLinks.data?.lineItemSpecifications.length ?? 0})</p>
                      {bomLinks.data?.lineItemSpecifications.map((spec) => (
                        <p key={spec.id} className="text-slate-600">
                          {spec.specType}: {spec.attribute} [{spec.minValue ?? spec.value ?? "N/A"} - {spec.maxValue ?? "N/A"} {spec.uom ?? ""}]
                        </p>
                      ))}
                      {bomLinks.data?.workflows.map((workflow) => (
                        <p key={workflow.id} className="mt-2 text-slate-700">
                          Workflow: {workflow.currentState}
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
