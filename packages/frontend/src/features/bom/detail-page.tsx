import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STANDARD_UOMS } from "@/lib/uom";
import { EntityIcon } from "@/components/entity-icon";

interface BomDetail {
  id: string;
  bomCode: string;
  version: number;
  revisionLabel?: string;
  status?: string;
  type: string;
  bomType?: "FG_BOM" | "FML_BOM";
  parentItem?: { id: string; itemCode: string; name: string; itemType: string } | null;
  lines?: Array<{
    id: string;
    lineNumber?: number | null;
    quantity: number;
    uom: string;
    scrapFactor?: number | null;
    phaseStep?: string | null;
    operationStep?: string | null;
    referenceDesignator?: string | null;
    item?: { id: string; itemCode: string; name: string };
    inputFormula?: { id: string; formulaCode: string; version: number; name: string } | null;
  }>;
  formula?: { id: string; formulaCode: string; version: number; name: string } | null;
}

interface BomLinksResponse {
  relatedChanges: Array<{ id: string; crNumber: string; title: string; status: string }>;
  workflows: Array<{ id: string; currentState: string }>;
  formulaSpecifications: Array<{ id: string; specType: string; attribute: string; value?: string | null; minValue?: number | null; maxValue?: number | null; uom?: string | null }>;
  lineItemSpecifications: Array<{ id: string; itemId: string | null; specType: string; attribute: string; value?: string | null; minValue?: number | null; maxValue?: number | null; uom?: string | null }>;
}

interface UomResponse {
  data: Array<{ value: string; label: string; category: string }>;
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
  recipeType: "FORMULA_RECIPE" | "FINISHED_GOOD_RECIPE";
}

interface BomHistoryResponse {
  currentId: string;
  history: Array<{
    id: string;
    bomCode: string;
    version: number;
    revisionLabel: string;
    status: string;
    updatedAt: string;
  }>;
}

export function BomDetailPage(): JSX.Element {
  const params = useParams();
  const bomId = String(params.id ?? "");
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [draftLines, setDraftLines] = useState<BomLineRow[]>([]);
  const [activeTab, setActiveTab] = useState<"details" | "history">("details");

  function renderStatusBadge(status?: string): JSX.Element {
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

  const bom = useQuery({
    queryKey: ["bom-detail-page", bomId],
    queryFn: async () => (await api.get<BomDetail>(`/bom/${bomId}`)).data,
    enabled: Boolean(bomId)
  });

  const links = useQuery({
    queryKey: ["bom-links-page", bomId],
    queryFn: async () => (await api.get<BomLinksResponse>(`/bom/${bomId}/links`)).data,
    enabled: Boolean(bomId)
  });

  const history = useQuery({
    queryKey: ["bom-history", bomId],
    queryFn: async () => (await api.get<BomHistoryResponse>(`/bom/${bomId}/history`)).data,
    enabled: Boolean(bomId)
  });
  const uomsQuery = useQuery({
    queryKey: ["config-uoms"],
    queryFn: async () => (await api.get<UomResponse>("/config/uoms")).data,
    retry: false
  });

  const latestId = useMemo(() => history.data?.history?.[0]?.id, [history.data?.history]);
  const isOldVersion = Boolean(latestId && latestId !== bomId);

  const items = useQuery({
    queryKey: ["bom-detail-items"],
    queryFn: async () => (await api.get<{ data: ItemOption[] }>("/items", { params: { pageSize: 500 } })).data
  });

  const formulas = useQuery({
    queryKey: ["bom-detail-formulas"],
    queryFn: async () =>
      (await api.get<{ data: FormulaListRow[] }>("/formulas", { params: { pageSize: 500 } })).data
  });

  const updateStructure = useMutation({
    mutationFn: async () => {
      const mapped = draftLines
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

      if (mapped.length === 0) {
        throw new Error("Add at least one BOM line.");
      }

      await api.put(`/bom/${bomId}/structure`, { lines: mapped });
    },
    onSuccess: async () => {
      setMessage("BOM updated.");
      setIsEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["bom-detail-page", bomId] });
      await queryClient.invalidateQueries({ queryKey: ["bom-links-page", bomId] });
      await queryClient.invalidateQueries({ queryKey: ["bom"] });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "Update failed");
    }
  });

  useEffect(() => {
    if (!bom.data) {
      return;
    }
    const rows =
      bom.data.lines?.map((line, index) => ({
        lineNumber: String(line.lineNumber ?? index + 1),
        sourceType: line.inputFormula?.id ? "FORMULA" : "ITEM",
        sourceId: line.inputFormula?.id ?? line.item?.id ?? "",
        quantity: String(line.quantity ?? ""),
        uom: line.uom ?? "kg",
        scrapFactor: line.scrapFactor ? String(line.scrapFactor) : "",
        phaseStep: line.phaseStep ?? "",
        operationStep: line.operationStep ?? "",
        referenceDesignator: line.referenceDesignator ?? ""
      })) ?? [];
    setDraftLines(
      rows.length
        ? rows
        : [
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
          ]
    );
  }, [bom.data?.id, isEditing]);

  function renumberLines(rows: BomLineRow[]): BomLineRow[] {
    return rows.map((row, index) => ({ ...row, lineNumber: String((index + 1) * 10) }));
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

  const itemOptions = useMemo(() => {
    const base = items.data?.data ?? [];
    if (bom.data?.bomType === "FG_BOM") {
      return base.filter((item) => item.itemType === "PACKAGING");
    }
    return base.filter((item) => item.itemType === "RAW_MATERIAL" || item.itemType === "INTERMEDIATE");
  }, [items.data?.data, bom.data?.bomType]);

  const inputFormulaOptions = useMemo(() => {
    const base = formulas.data?.data ?? [];
    return base.filter((row) => row.recipeType === "FORMULA_RECIPE");
  }, [formulas.data?.data]);

  const validationWarnings = useMemo(() => {
    if (!isEditing) {
      return [];
    }
    const warnings: string[] = [];
    const itemById = new Map((items.data?.data ?? []).map((item) => [item.id, item]));
    const formulaById = new Map((formulas.data?.data ?? []).map((row) => [row.id, row]));
    const activeLines = draftLines.filter((line) => line.sourceId);

    if (bom.data?.bomType === "FG_BOM") {
      if (!activeLines.some((line) => line.sourceType === "FORMULA")) {
        warnings.push("FG BOM requires at least one formula line.");
      }
      for (const [index, line] of activeLines.entries()) {
        if (line.sourceType === "ITEM") {
          const item = itemById.get(line.sourceId);
          if (item && item.itemType !== "PACKAGING") {
            warnings.push(`Line ${index + 1}: FG BOM item inputs must be Packaging.`);
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
      for (const [index, line] of activeLines.entries()) {
        if (line.sourceType === "ITEM") {
          const item = itemById.get(line.sourceId);
          if (item && !["RAW_MATERIAL", "INTERMEDIATE"].includes(item.itemType)) {
            warnings.push(`Line ${index + 1}: FML BOM item inputs must be Raw Material or Intermediate.`);
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
  }, [isEditing, draftLines, bom.data?.bomType, items.data?.data, formulas.data?.data]);

  if (bom.isLoading || links.isLoading) {
    return <div className="rounded-lg bg-white p-4">Loading BOM details...</div>;
  }

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-slate-100 p-2">
            <EntityIcon kind="bom" size={20} />
          </div>
          <div>
          <p className="font-mono text-sm text-slate-500">
            {bom.data?.bomCode} v{bom.data?.version} ({bom.data?.revisionLabel ?? "1.1"})
          </p>
        <h2 className="font-heading text-xl">BOM {bom.data?.bomType === "FG_BOM" ? "FG" : "FML"}</h2>
        <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
          <span>Status</span>
          {renderStatusBadge(bom.data?.status)}
        </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {bom.data?.status === "DRAFT" ? (
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
          <Link to="/bom" className="rounded border border-slate-300 bg-white px-3 py-1 text-sm">
            Back to BOM
          </Link>
        </div>
      </div>

      {bom.data?.status === "DRAFT" && !isEditing ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>This BOM is in Draft and can be edited.</span>
            <button
              onClick={() => setIsEditing(true)}
              className="rounded bg-primary px-3 py-1 text-sm text-white"
              type="button"
            >
              Edit Structure
            </button>
          </div>
        </div>
      ) : null}

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
      </div>

      {isOldVersion ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          You are viewing an old version of this BOM. Use the History tab to navigate to the latest version.
        </div>
      ) : null}

      {activeTab === "details" ? (
      <>
      <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
        <p className="mb-1 font-medium">Parent</p>
        {bom.data?.bomType === "FG_BOM" ? (
          bom.data?.parentItem ? (
            <Link to={`/items/${bom.data.parentItem.id}`} className="text-primary hover:underline">
              {bom.data.parentItem.itemCode} - {bom.data.parentItem.name}
            </Link>
          ) : (
            <p className="text-slate-500">Unassigned FG</p>
          )
        ) : bom.data?.formula ? (
          <Link to={`/formulas/${bom.data.formula.id}`} className="text-primary hover:underline">
            {bom.data.formula.formulaCode} v{bom.data.formula.version} - {bom.data.formula.name}
          </Link>
        ) : (
          <p className="text-slate-500">Unassigned Formula</p>
        )}
      </div>

      <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-medium">BOM Line Items</p>
          {isEditing ? (
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              onClick={() =>
                setDraftLines((prev) =>
                  renumberLines([
                    ...prev,
                    {
                      lineNumber: String((prev.length + 1) * 10),
                      sourceType: "ITEM",
                      sourceId: "",
                      quantity: "",
                      uom: "kg",
                      scrapFactor: "",
                      phaseStep: "",
                      operationStep: "",
                      referenceDesignator: ""
                    }
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
                <th className="px-2 py-2">Line #</th>
                <th className="px-2 py-2">Input</th>
                <th className="px-2 py-2">Quantity</th>
                <th className="px-2 py-2">UOM</th>
                <th className="px-2 py-2">Scrap %</th>
                <th className="px-2 py-2">Phase Step</th>
                <th className="px-2 py-2">Operation Step</th>
                <th className="px-2 py-2">Ref Designator</th>
                {isEditing ? <th className="px-2 py-2 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {isEditing
                ? draftLines.map((line, index) => (
                    <tr key={`${line.sourceId}-${index}`} className="border-b border-slate-100">
                      <td className="px-2 py-2">
                        <input
                          className="w-16 rounded border border-slate-300 bg-slate-50 px-2 py-1"
                          value={line.lineNumber}
                          readOnly
                        />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex gap-2">
                          <select
                            className="rounded border border-slate-300 bg-white px-2 py-1"
                            value={line.sourceType}
                            onChange={(event) =>
                              setDraftLines((prev) =>
                                prev.map((row, rowIndex) =>
                                  rowIndex === index ? { ...row, sourceType: event.target.value as "ITEM" | "FORMULA", sourceId: "" } : row
                                )
                              )
                            }
                          >
                            <option value="ITEM">Item</option>
                            <option value="FORMULA">Formula</option>
                          </select>
                          <select
                            className="min-w-[200px] rounded border border-slate-300 bg-white px-2 py-1"
                            value={line.sourceId}
                            onChange={(event) =>
                              setDraftLines((prev) =>
                                prev.map((row, rowIndex) => (rowIndex === index ? { ...row, sourceId: event.target.value } : row))
                              )
                            }
                          >
                            <option value="">Select</option>
                            {line.sourceType === "ITEM"
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
                          value={line.quantity}
                          onChange={(event) =>
                            setDraftLines((prev) =>
                              prev.map((row, rowIndex) => (rowIndex === index ? { ...row, quantity: event.target.value } : row))
                            )
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          className="w-24 rounded border border-slate-300 bg-white px-2 py-1"
                          value={line.uom}
                          onChange={(event) =>
                            setDraftLines((prev) =>
                              prev.map((row, rowIndex) => (rowIndex === index ? { ...row, uom: event.target.value } : row))
                            )
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
                          value={line.scrapFactor}
                          onChange={(event) =>
                            setDraftLines((prev) =>
                              prev.map((row, rowIndex) => (rowIndex === index ? { ...row, scrapFactor: event.target.value } : row))
                            )
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-28 rounded border border-slate-300 px-2 py-1"
                          value={line.phaseStep}
                          onChange={(event) =>
                            setDraftLines((prev) =>
                              prev.map((row, rowIndex) => (rowIndex === index ? { ...row, phaseStep: event.target.value } : row))
                            )
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-28 rounded border border-slate-300 px-2 py-1"
                          value={line.operationStep}
                          onChange={(event) =>
                            setDraftLines((prev) =>
                              prev.map((row, rowIndex) => (rowIndex === index ? { ...row, operationStep: event.target.value } : row))
                            )
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-28 rounded border border-slate-300 px-2 py-1"
                          value={line.referenceDesignator}
                          onChange={(event) =>
                            setDraftLines((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index ? { ...row, referenceDesignator: event.target.value } : row
                              )
                            )
                          }
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
                            onClick={() => setDraftLines((prev) => renumberLines(prev.filter((_, rowIndex) => rowIndex !== index)))}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                : bom.data?.lines?.map((line, index) => (
                    <tr key={line.id} className="border-b border-slate-100">
                      <td className="px-2 py-2">{line.lineNumber ?? index + 1}</td>
                      <td className="px-2 py-2">
                        {line.inputFormula?.id ? (
                          <Link to={`/formulas/${line.inputFormula.id}`} className="text-primary hover:underline">
                            {line.inputFormula.formulaCode} v{line.inputFormula.version} - {line.inputFormula.name}
                          </Link>
                        ) : line.item?.id ? (
                          <Link to={`/items/${line.item.id}`} className="text-primary hover:underline">
                            {line.item.itemCode} - {line.item.name}
                          </Link>
                        ) : (
                          <span>{line.item?.itemCode ?? "Unknown Item"}</span>
                        )}
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

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="mb-1 font-medium">Formula Specs</p>
          {links.data?.formulaSpecifications.map((spec) => (
            <p key={spec.id} className="text-slate-600">
              {spec.specType}: {spec.attribute} [{spec.minValue ?? spec.value ?? "N/A"} - {spec.maxValue ?? "N/A"} {spec.uom ?? ""}]
            </p>
          ))}
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="mb-1 font-medium">Line Item Specs</p>
          {links.data?.lineItemSpecifications.map((spec) => (
            <p key={spec.id} className="text-slate-600">
              {spec.specType}: {spec.attribute} [{spec.minValue ?? spec.value ?? "N/A"} - {spec.maxValue ?? "N/A"} {spec.uom ?? ""}]
            </p>
          ))}
        </div>
      </div>
      </>
      ) : (
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="mb-2 font-medium">BOM Version History</p>
          {history.data?.history?.length ? (
            <div className="space-y-2">
              {history.data.history.map((entry) => (
                <Link
                  key={entry.id}
                  to={`/bom/${entry.id}`}
                  className={`block rounded border px-3 py-2 ${
                    entry.id === bomId ? "border-primary bg-white" : "border-slate-200 bg-white hover:border-primary"
                  }`}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono">{entry.bomCode} v{entry.version}</span>
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
