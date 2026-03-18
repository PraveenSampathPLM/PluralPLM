import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STANDARD_UOMS } from "@/lib/uom";
import { EntityIcon } from "@/components/entity-icon";
import { DetailHeaderCard } from "@/components/detail-header-card";
import { StatusBadge } from "@/components/status-badge";
import { CheckoutBar } from "@/components/checkout-bar";
import { toast } from "sonner";

interface SpecTemplate {
  specType: string;
  label: string;
  attributes: Array<{ key: string; defaultUom?: string; defaultTestMethod?: string }>;
}

interface SpecRow {
  clientId: string;
  id?: string;
  specType: string;
  attribute: string;
  value: string;
  minValue: string;
  maxValue: string;
  uom: string;
  testMethod: string;
}

interface FGDetail {
  id: string;
  version: number;
  revisionLabel: string;
  status: string;
  effectiveDate: string | null;
  checkedOutById?: string | null;
  checkedOutBy?: { id: string; name: string } | null;
  checkedOutAt?: string | null;
  fgItem: { id: string; itemCode: string; name: string; itemType: string; industryType?: string | null };
  formula: { id: string; formulaCode: string; version: number; name: string; status: string } | null;
  packagingLines: Array<{
    id?: string;
    lineNumber?: number | null;
    quantity: number;
    uom: string;
    itemId: string;
    item: { id: string; itemCode: string; name: string } | null;
  }>;
}

interface FGLinksResponse {
  fg: FGDetail;
  relatedChanges: Array<{ id: string; crNumber: string; title: string; status: string }>;
  workflows: Array<{ id: string; currentState: string }>;
  formulaSpecifications: Array<{ id: string; specType: string; attribute: string; value?: string | null; minValue?: number | null; maxValue?: number | null; uom?: string | null; testMethod?: string | null }>;
  fgItemSpecifications: Array<{ id: string; specType: string; attribute: string; value?: string | null; minValue?: number | null; maxValue?: number | null; uom?: string | null; testMethod?: string | null }>;
  packagingSpecifications: Array<{ id: string; itemId?: string | null; specType: string; attribute: string; value?: string | null; minValue?: number | null; maxValue?: number | null; uom?: string | null; testMethod?: string | null }>;
}

interface FGHistoryResponse {
  currentId: string;
  history: Array<{
    id: string;
    version: number;
    revisionLabel: string;
    status: string;
    updatedAt: string;
    fgItem: { itemCode: string; name: string };
  }>;
}

interface PackagingLineRow {
  lineNumber: string;
  itemId: string;
  quantity: string;
  uom: string;
}

interface ItemOption {
  id: string;
  name: string;
  itemCode: string;
  itemType: string;
}

export function FgDetailPage(): JSX.Element {
  const params = useParams();
  const navigate = useNavigate();
  const fgId = String(params.id ?? "");
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [draftLines, setDraftLines] = useState<PackagingLineRow[]>([]);
  const [activeTab, setActiveTab] = useState<"details" | "specs" | "history">("details");
  const [isEditingSpecs, setIsEditingSpecs] = useState(false);
  const [specRows, setSpecRows] = useState<SpecRow[]>([]);

  const fg = useQuery({
    queryKey: ["fg-detail", fgId],
    queryFn: async () => (await api.get<FGDetail>(`/fg/${fgId}`)).data,
    enabled: Boolean(fgId)
  });

  const links = useQuery({
    queryKey: ["fg-links", fgId],
    queryFn: async () => (await api.get<FGLinksResponse>(`/fg/${fgId}/links`)).data,
    enabled: Boolean(fgId)
  });

  const history = useQuery({
    queryKey: ["fg-history", fgId],
    queryFn: async () => (await api.get<FGHistoryResponse>(`/fg/${fgId}/history`)).data,
    enabled: Boolean(fgId)
  });

  const uomsQuery = useQuery({
    queryKey: ["config-uoms"],
    queryFn: async () => (await api.get<{ data: Array<{ value: string; label: string; category: string }> }>("/config/uoms")).data,
    retry: false
  });

  const items = useQuery({
    queryKey: ["fg-detail-items"],
    queryFn: async () => (await api.get<{ data: ItemOption[] }>("/items", { params: { pageSize: 500 } })).data
  });

  const industryType = fg.data?.fgItem?.industryType ?? "CHEMICAL";

  const specTemplates = useQuery({
    queryKey: ["spec-templates", industryType],
    queryFn: async () =>
      (await api.get<{ data: SpecTemplate[] }>(`/specifications/templates/${industryType}`)).data
  });

  const saveSpecs = useMutation({
    mutationFn: async () => {
      if (!fg.data?.fgItem?.id) throw new Error("FG item not found.");
      await api.post("/specifications/bulk-upsert", {
        targetType: "item",
        targetId: fg.data.fgItem.id,
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
      toast.success("Specifications saved.");
      await queryClient.invalidateQueries({ queryKey: ["fg-links", fgId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to save specifications.")
  });

  const latestId = useMemo(() => history.data?.history?.[0]?.id, [history.data?.history]);
  const isOldVersion = Boolean(latestId && latestId !== fgId);

  const packagingItemOptions = useMemo(
    () => (items.data?.data ?? []).filter((item) => item.itemType === "PACKAGING"),
    [items.data?.data]
  );

  const updatePackaging = useMutation({
    mutationFn: async () => {
      const mapped = draftLines
        .filter((row) => row.itemId && row.quantity)
        .map((row, idx) => ({
          lineNumber: row.lineNumber ? Number(row.lineNumber) : (idx + 1) * 10,
          itemId: row.itemId,
          quantity: Number(row.quantity),
          uom: row.uom || "ea"
        }));

      await api.put(`/fg/${fgId}/packaging`, { packagingLines: mapped });
    },
    onSuccess: async () => {
      toast.success("Packaging updated.");
      setIsEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["fg-detail", fgId] });
      await queryClient.invalidateQueries({ queryKey: ["fg-links", fgId] });
      await queryClient.invalidateQueries({ queryKey: ["fg"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  });

  useEffect(() => {
    if (!fg.data) return;
    const rows = fg.data.packagingLines.map((line, idx) => ({
      lineNumber: String(line.lineNumber ?? (idx + 1) * 10),
      itemId: line.itemId,
      quantity: String(line.quantity),
      uom: line.uom
    }));
    setDraftLines(rows);
  }, [fg.data?.id, isEditing]);

  function renumber(rows: PackagingLineRow[]): PackagingLineRow[] {
    return rows.map((row, idx) => ({ ...row, lineNumber: String((idx + 1) * 10) }));
  }

  if (fg.isLoading) {
    return <div className="rounded-lg bg-white p-4">Loading Finished Good details...</div>;
  }

  const fgData = fg.data;
  const currentUserId = (JSON.parse(localStorage.getItem("plm_user") || "{}") as { id?: string }).id ?? "";
  const currentUserRole = (JSON.parse(localStorage.getItem("plm_user") || "{}") as { role?: string }).role ?? "";
  const isAdmin = ["System Admin", "PLM Admin", "Container Admin"].includes(currentUserRole);

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <DetailHeaderCard
        icon={<EntityIcon kind="bom" size={20} />}
        code={`${fgData?.fgItem.itemCode ?? ""} v${fgData?.version ?? ""} (${fgData?.revisionLabel ?? "1.1"})`}
        title={fgData?.fgItem.name ?? "Finished Good"}
        meta={
          <span className="inline-flex items-center gap-2">
            <span>Status</span>
            <StatusBadge status={fgData?.status ?? "IN_WORK"} />
          </span>
        }
        backTo="/fg"
        backLabel="Back to Finished Good"
        actions={
          <>
            {fgData?.fgItem ? (
              <button
                type="button"
                onClick={() => navigate(`/items/${fgData.fgItem.id}/thread?node=fgStructure`)}
                className="rounded bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-700"
              >
                🔗 Digital Thread
              </button>
            ) : null}
            {fgData?.status === "IN_WORK" ? (
              isEditing ? (
                <>
                  <button
                    onClick={() => updatePackaging.mutate()}
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
                  Edit Packaging
                </button>
              )
            ) : null}
          </>
        }
      />

      {fgData ? (
        <CheckoutBar
          entityType="fg"
          entityId={fgId}
          info={{
            checkedOutById: fgData.checkedOutById,
            checkedOutBy: fgData.checkedOutBy,
            checkedOutAt: fgData.checkedOutAt,
            status: fgData.status
          }}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          queryKey={["fg-detail", fgId]}
        />
      ) : null}

      {isOldVersion ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          You are viewing an old version. Use the History tab to navigate to the latest version.
        </div>
      ) : null}

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
          onClick={() => setActiveTab("specs")}
          className={`px-3 py-2 ${activeTab === "specs" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`}
        >
          Specs
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`px-3 py-2 ${activeTab === "history" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`}
        >
          History
        </button>
      </div>

      {activeTab === "specs" ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium">Product Specifications</p>
            {!isEditingSpecs ? (
              <button
                type="button"
                onClick={() => {
                  const existing = links.data?.fgItemSpecifications ?? [];
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
                className="rounded border border-slate-300 bg-white px-3 py-1 text-xs"
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
                      const template = (specTemplates.data?.data ?? []).find((t) => t.specType === row.specType);
                      const attrs = template?.attributes ?? [];
                      return (
                        <tr key={row.clientId} className="border-t border-slate-100">
                          <td className="px-2 py-2">
                            <select
                              value={row.specType}
                              onChange={(e) => {
                                const nextSpecType = e.target.value;
                                const nextTemplate = (specTemplates.data?.data ?? []).find((t) => t.specType === nextSpecType);
                                const nextAttr = nextTemplate?.attributes[0];
                                setSpecRows((prev) =>
                                  prev.map((line) =>
                                    line.clientId === row.clientId
                                      ? { ...line, specType: nextSpecType, attribute: nextAttr?.key ?? "", uom: nextAttr?.defaultUom ?? line.uom, testMethod: nextAttr?.defaultTestMethod ?? line.testMethod }
                                      : line
                                  )
                                );
                              }}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            >
                              {(specTemplates.data?.data ?? []).map((opt) => (
                                <option key={opt.specType} value={opt.specType}>{opt.specType}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={row.attribute}
                              onChange={(e) => {
                                const attr = attrs.find((a) => a.key === e.target.value);
                                setSpecRows((prev) =>
                                  prev.map((line) =>
                                    line.clientId === row.clientId
                                      ? { ...line, attribute: e.target.value, uom: attr?.defaultUom ?? line.uom, testMethod: attr?.defaultTestMethod ?? line.testMethod }
                                      : line
                                  )
                                );
                              }}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            >
                              {attrs.map((a) => (
                                <option key={`${row.clientId}-${a.key}`} value={a.key}>{a.key}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              value={row.value}
                              onChange={(e) => setSpecRows((prev) => prev.map((line) => (line.clientId === row.clientId ? { ...line, value: e.target.value } : line)))}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              value={row.minValue}
                              onChange={(e) => setSpecRows((prev) => prev.map((line) => (line.clientId === row.clientId ? { ...line, minValue: e.target.value } : line)))}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              value={row.maxValue}
                              onChange={(e) => setSpecRows((prev) => prev.map((line) => (line.clientId === row.clientId ? { ...line, maxValue: e.target.value } : line)))}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={row.uom}
                              onChange={(e) => setSpecRows((prev) => prev.map((line) => (line.clientId === row.clientId ? { ...line, uom: e.target.value } : line)))}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            >
                              {(uomsQuery.data?.data ?? STANDARD_UOMS).map((uom) => (
                                <option key={uom.value} value={uom.value}>{uom.value}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              value={row.testMethod}
                              onChange={(e) => setSpecRows((prev) => prev.map((line) => (line.clientId === row.clientId ? { ...line, testMethod: e.target.value } : line)))}
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
                    const attr = template?.attributes?.[0];
                    setSpecRows((prev) => [
                      ...prev,
                      {
                        clientId: `spec-${Date.now()}`,
                        specType: template?.specType ?? "PHYSICAL",
                        attribute: attr?.key ?? "",
                        value: "",
                        minValue: "",
                        maxValue: "",
                        uom: attr?.defaultUom ?? "",
                        testMethod: attr?.defaultTestMethod ?? ""
                      }
                    ]);
                  }}
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-xs"
                >
                  Add Spec Line
                </button>
                {industryType === "FOOD_BEVERAGE" ? (
                  <button
                    type="button"
                    onClick={() => {
                      const nutrition = (specTemplates.data?.data ?? []).find((t) => t.specType === "NUTRITION");
                      if (!nutrition) return;
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
          ) : links.data?.fgItemSpecifications?.length ? (
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
                  {links.data.fgItemSpecifications.map((spec) => (
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
            <p className="text-slate-500">No specifications defined. Click "Edit Specs" to add specifications for this product.</p>
          )}
        </div>
      ) : activeTab === "details" ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="mb-2 font-medium">Finished Good Item</p>
              {fgData?.fgItem ? (
                <Link to={`/items/${fgData.fgItem.id}`} className="text-primary hover:underline">
                  {fgData.fgItem.itemCode} — {fgData.fgItem.name}
                </Link>
              ) : null}
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="mb-2 font-medium">Linked Formula</p>
              {fgData?.formula ? (
                <Link to={`/formulas/${fgData.formula.id}`} className="text-primary hover:underline">
                  {fgData.formula.formulaCode} v{fgData.formula.version} — {fgData.formula.name}
                </Link>
              ) : (
                <p className="text-slate-400">No formula linked</p>
              )}
            </div>
          </div>

          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">Packaging Components</p>
              {isEditing ? (
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  onClick={() =>
                    setDraftLines((prev) =>
                      renumber([
                        ...prev,
                        { lineNumber: String((prev.length + 1) * 10), itemId: "", quantity: "", uom: "ea" }
                      ])
                    )
                  }
                >
                  Add Line
                </button>
              ) : null}
            </div>
            <div className="overflow-x-auto rounded border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-2 py-2">Line #</th>
                    <th className="px-2 py-2">Packaging Item</th>
                    <th className="px-2 py-2">Quantity</th>
                    <th className="px-2 py-2">UOM</th>
                    {isEditing ? <th className="px-2 py-2 text-right">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {isEditing
                    ? draftLines.map((line, index) => (
                        <tr key={`${line.itemId}-${index}`} className="border-b border-slate-100">
                          <td className="px-2 py-2">
                            <input
                              className="w-16 rounded border border-slate-300 bg-slate-50 px-2 py-1"
                              value={line.lineNumber}
                              readOnly
                            />
                          </td>
                          <td className="px-2 py-2">
                            <select
                              className="min-w-[220px] rounded border border-slate-300 bg-white px-2 py-1"
                              value={line.itemId}
                              onChange={(e) =>
                                setDraftLines((prev) =>
                                  prev.map((row, i) => (i === index ? { ...row, itemId: e.target.value } : row))
                                )
                              }
                            >
                              <option value="">Select packaging item</option>
                              {packagingItemOptions.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.itemCode} — {item.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              className="w-24 rounded border border-slate-300 px-2 py-1"
                              value={line.quantity}
                              onChange={(e) =>
                                setDraftLines((prev) =>
                                  prev.map((row, i) => (i === index ? { ...row, quantity: e.target.value } : row))
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <select
                              className="w-24 rounded border border-slate-300 bg-white px-2 py-1"
                              value={line.uom}
                              onChange={(e) =>
                                setDraftLines((prev) =>
                                  prev.map((row, i) => (i === index ? { ...row, uom: e.target.value } : row))
                                )
                              }
                            >
                              {(uomsQuery.data?.data ?? STANDARD_UOMS).map((uom) => (
                                <option key={uom.value} value={uom.value}>{uom.value}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              className="text-xs text-red-600 hover:underline"
                              onClick={() =>
                                setDraftLines((prev) => renumber(prev.filter((_, i) => i !== index)))
                              }
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    : fgData?.packagingLines.map((line, index) => (
                        <tr key={line.itemId + index} className="border-b border-slate-100">
                          <td className="px-2 py-2">{line.lineNumber ?? index + 1}</td>
                          <td className="px-2 py-2">
                            {line.item ? (
                              <Link to={`/items/${line.item.id}`} className="text-primary hover:underline">
                                {line.item.itemCode} — {line.item.name}
                              </Link>
                            ) : (
                              <span className="text-slate-400">Unknown item</span>
                            )}
                          </td>
                          <td className="px-2 py-2">{line.quantity}</td>
                          <td className="px-2 py-2">{line.uom}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="mb-2 font-medium">Related Change Requests ({links.data?.relatedChanges.length ?? 0})</p>
              {links.data?.relatedChanges.map((change) => (
                <Link key={change.id} to={`/changes/${change.id}`} className="block text-primary hover:underline">
                  {change.crNumber}: {change.title} ({change.status})
                </Link>
              ))}
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="mb-2 font-medium">Formula Specifications ({links.data?.formulaSpecifications.length ?? 0})</p>
              {links.data?.formulaSpecifications.map((spec) => (
                <p key={spec.id} className="text-slate-600">
                  {spec.specType}: {spec.attribute} [{spec.minValue ?? spec.value ?? "N/A"} – {spec.maxValue ?? "N/A"} {spec.uom ?? ""}]
                </p>
              ))}
            </div>
          </div>
        </>
      ) : activeTab === "history" ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="mb-2 font-medium">Finished Good Version History</p>
          {history.data?.history?.length ? (
            <div className="space-y-2">
              {history.data.history.map((entry) => (
                <Link
                  key={entry.id}
                  to={`/fg/${entry.id}`}
                  className={`block rounded border px-3 py-2 ${
                    entry.id === fgId ? "border-primary bg-white" : "border-slate-200 bg-white hover:border-primary"
                  }`}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono">{entry.fgItem.itemCode} v{entry.version}</span>
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
      ) : null}
    </div>
  );
}
