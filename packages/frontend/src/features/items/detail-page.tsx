import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ObjectActionsMenu, type ObjectActionKey } from "@/components/object-actions-menu";
import { useContainerStore } from "@/store/container.store";
import { FloatingInput, FloatingSelect } from "@/components/floating-field";
import { STANDARD_UOMS } from "@/lib/uom";
import { EntityIcon } from "@/components/entity-icon";

interface ItemDetail {
  id: string;
  itemCode: string;
  name: string;
  itemType: string;
  industryType?: string;
  status: string;
  uom: string;
  description?: string | null;
  density?: number | null;
  viscosity?: number | null;
  pH?: number | null;
  flashPoint?: number | null;
  regulatoryFlags?: Record<string, boolean> | null;
  attributes?: Record<string, unknown> | null;
  revisionLabel?: string;
  revisionMajor?: number;
  revisionIteration?: number;
}

interface ItemLinksResponse {
  item: { id: string; itemCode: string; name: string };
  formulaUsages: Array<{
    id: string;
    quantity: number;
    uom: string;
    formula: { id: string; formulaCode: string; version: number; name: string; status: string };
  }>;
  bomUsages: Array<{
    id: string;
    quantity: number;
    uom: string;
    bom: { id: string; bomCode: string; version: number; type: string };
  }>;
  specifications: Array<{ id: string; specType: string; attribute: string; value?: string | null; minValue?: number | null; maxValue?: number | null; uom?: string | null }>;
  relatedChanges: Array<{ id: string; crNumber: string; title: string; status: string }>;
  workflows: Array<{ id: string; currentState: string }>;
}

interface ItemHistoryResponse {
  currentId: string;
  history: Array<{
    id: string;
    itemCode: string;
    revisionLabel: string;
    revisionMajor: number;
    revisionIteration: number;
    status: string;
    updatedAt: string;
  }>;
}

interface DocumentRecord {
  id: string;
  docNumber: string;
  name: string;
  fileName: string;
  docType: string;
  status: string;
  createdAt: string;
}

interface DocumentListResponse {
  data: DocumentRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface ConfigResponse {
  attributeDefinitions: {
    ITEM: Array<{ key: string; label: string; type: "text" | "number" | "boolean"; required: boolean }>;
  };
}

interface DocumentSearchResponse {
  data: Array<{ id: string; docNumber: string; name: string; docType: string; status: string }>;
  total: number;
  page: number;
  pageSize: number;
}

interface UomResponse {
  data: Array<{ value: string; label: string; category: string }>;
}

interface SpecTemplate {
  specType: string;
  label: string;
  attributes: Array<{ key: string; defaultUom?: string; defaultTestMethod?: string }>;
}

export function ItemDetailPage(): JSX.Element {
  const params = useParams();
  const itemId = String(params.id ?? "");
  const [activeTab, setActiveTab] = useState<"details" | "specs" | "workflow" | "history">("details");
  const [message, setMessage] = useState("");
  const { selectedContainerId } = useContainerStore();
  const queryClient = useQueryClient();
  const [docSearch, setDocSearch] = useState("");
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [isEditingSpecs, setIsEditingSpecs] = useState(false);
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
  const [itemDraft, setItemDraft] = useState({
    name: "",
    description: "",
    uom: "kg",
    density: "",
    viscosity: "",
    pH: "",
    flashPoint: "",
    casNumber: "",
    reachRegistration: "",
    ghsClassification: "",
    boilingPoint: "",
    customAttributes: {} as Record<string, string>
  });

  const item = useQuery({
    queryKey: ["item-detail", itemId],
    queryFn: async () => (await api.get<ItemDetail>(`/items/${itemId}`)).data,
    enabled: Boolean(itemId)
  });

  const links = useQuery({
    queryKey: ["item-links-detail", itemId],
    queryFn: async () => (await api.get<ItemLinksResponse>(`/items/${itemId}/links`)).data,
    enabled: Boolean(itemId)
  });

  const history = useQuery({
    queryKey: ["item-history", itemId],
    queryFn: async () => (await api.get<ItemHistoryResponse>(`/items/${itemId}/history`)).data,
    enabled: Boolean(itemId)
  });

  const config = useQuery({
    queryKey: ["item-config"],
    queryFn: async () => (await api.get<ConfigResponse>("/config")).data,
    retry: false
  });
  const uomsQuery = useQuery({
    queryKey: ["config-uoms"],
    queryFn: async () => (await api.get<UomResponse>("/config/uoms")).data,
    retry: false
  });
  const specTemplates = useQuery({
  queryKey: ["spec-templates", item.data?.industryType ?? "CHEMICAL"],
  queryFn: async () =>
   (await api.get<{ data: SpecTemplate[] }>(`/specifications/templates/${item.data?.industryType ?? "CHEMICAL"}`)).data
 });

  const documents = useQuery({
    queryKey: ["item-documents", itemId],
    queryFn: async () =>
      (
        await api.get<DocumentListResponse>("/documents", {
          params: { entityType: "ITEM", entityId: itemId, page: 1, pageSize: 20 }
        })
      ).data,
    enabled: Boolean(itemId)
  });

  const documentSearch = useQuery({
    queryKey: ["document-search", docSearch, selectedContainerId],
    queryFn: async () =>
      (
        await api.get<DocumentSearchResponse>("/documents", {
          params: {
            search: docSearch,
            page: 1,
            pageSize: 6,
            ...(selectedContainerId ? { containerId: selectedContainerId } : {})
          }
        })
      ).data,
    enabled: docSearch.trim().length > 1
  });

  const linkDocument = useMutation({
    mutationFn: async (documentId: string) => {
      await api.post(`/documents/${documentId}/link`, {
        entityType: "ITEM",
        entityId: itemId
      });
    },
    onSuccess: async () => {
      setMessage("Document linked to item.");
      setDocSearch("");
      await queryClient.invalidateQueries({ queryKey: ["item-documents", itemId] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Failed to link document.")
  });

  const updateItem = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        name: itemDraft.name.trim(),
        description: itemDraft.description.trim() || null,
        uom: itemDraft.uom
      };
      if (itemDraft.density) payload.density = Number(itemDraft.density);
      if (itemDraft.viscosity) payload.viscosity = Number(itemDraft.viscosity);
      if (itemDraft.pH) payload.pH = Number(itemDraft.pH);
      if (itemDraft.flashPoint) payload.flashPoint = Number(itemDraft.flashPoint);
      payload.casNumber = itemDraft.casNumber.trim();
      payload.reachRegistration = itemDraft.reachRegistration.trim();
      payload.ghsClassification = itemDraft.ghsClassification.trim();
      if (itemDraft.boilingPoint) payload.boilingPoint = Number(itemDraft.boilingPoint);
      payload.customAttributes = itemDraft.customAttributes;
      await api.put(`/items/${itemId}`, payload);
    },
    onSuccess: async () => {
      setIsEditingItem(false);
      setMessage("Item updated.");
      await queryClient.invalidateQueries({ queryKey: ["item-detail", itemId] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Failed to update item.")
  });

  const saveSpecs = useMutation({
    mutationFn: async () => {
      await api.post("/specifications/bulk-upsert", {
        targetType: "item",
        targetId: itemId,
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
      await queryClient.invalidateQueries({ queryKey: ["item-links-detail", itemId] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Failed to save specifications.")
  });

  const latestId = useMemo(() => history.data?.history?.[0]?.id, [history.data?.history]);
  const isOldVersion = Boolean(latestId && latestId !== itemId);
  const attributes =
    item.data?.attributes && typeof item.data.attributes === "object" && !Array.isArray(item.data.attributes)
      ? (item.data.attributes as Record<string, unknown>)
      : {};
  const customAttributes =
    attributes.customAttributes && typeof attributes.customAttributes === "object" && !Array.isArray(attributes.customAttributes)
      ? (attributes.customAttributes as Record<string, unknown>)
      : {};
  const attributeDefinitions = config.data?.attributeDefinitions?.ITEM ?? [];
  const regulatoryFlags =
    item.data?.regulatoryFlags && typeof item.data.regulatoryFlags === "object" && !Array.isArray(item.data.regulatoryFlags)
      ? (item.data.regulatoryFlags as Record<string, boolean>)
      : {};
  const activeRegulatoryFlags = Object.entries(regulatoryFlags)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key);
  const formatAttributeValue = (value: unknown): string => {
    if (value === null || value === undefined || value === "") {
      return "—";
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
    return String(value);
  };
  const densityUnit = "g/cm3";
  const viscosityUnit = "cP";
  const phUnit = "pH";
  const flashPointUnit = "C";
  const canCheckout = item.data?.status === "DRAFT";
  const canEdit = item.data?.status === "UNDER_CHANGE";

  useEffect(() => {
    if (!item.data || isEditingItem) {
      return;
    }
    setItemDraft({
      name: item.data.name ?? "",
      description: item.data.description ?? "",
      uom: item.data.uom ?? "kg",
      density: item.data.density ? String(item.data.density) : "",
      viscosity: item.data.viscosity ? String(item.data.viscosity) : "",
      pH: item.data.pH ? String(item.data.pH) : "",
      flashPoint: item.data.flashPoint ? String(item.data.flashPoint) : "",
      casNumber: formatAttributeValue(attributes.casNumber) === "—" ? "" : String(attributes.casNumber ?? ""),
      reachRegistration: formatAttributeValue(attributes.reachRegistration) === "—" ? "" : String(attributes.reachRegistration ?? ""),
      ghsClassification: formatAttributeValue(attributes.ghsClassification) === "—" ? "" : String(attributes.ghsClassification ?? ""),
      boilingPoint: attributes.boilingPoint ? String(attributes.boilingPoint) : "",
      customAttributes: Object.fromEntries(
        attributeDefinitions.map((definition) => [definition.key, String(customAttributes[definition.key] ?? "")])
      )
    });
  }, [item.data, isEditingItem, attributes, attributeDefinitions, customAttributes]);

  if (item.isLoading || links.isLoading) {
    return <div className="rounded-lg bg-white p-4">Loading item details...</div>;
  }

  const itemActions: Array<{ key: ObjectActionKey; label: string; disabled?: boolean; danger?: boolean }> = [
    { key: "create_release", label: "Create Release" },
    { key: "create_change", label: "Create Change" },
    { key: "checkout", label: "Check Out", disabled: !canCheckout },
    { key: "checkin", label: "Check In", disabled: !canEdit },
    { key: "revise", label: "Revise" },
    { key: "copy", label: "Copy" },
    { key: "delete", label: "Delete", danger: true }
  ];

  async function runItemAction(action: ObjectActionKey): Promise<void> {
    const current = item.data;
    if (!current) {
      return;
    }
    try {
      if (action === "create_release") {
        await api.post("/releases", {
          title: `Release ${current.itemCode}`,
          description: `Release request created from ${current.itemCode} - ${current.name}.`,
          containerId: selectedContainerId || undefined,
          targetItems: [current.id],
          targetBoms: [],
          targetFormulas: [],
          status: "NEW"
        });
        setMessage(`Release request created for ${current.itemCode}.`);
      } else if (action === "create_change") {
        await api.post("/changes", {
          title: `Change for ${current.itemCode}`,
          description: `Change request created from ${current.itemCode} - ${current.name}.`,
          containerId: selectedContainerId || undefined,
          type: "ECR",
          priority: "MEDIUM",
          status: "NEW",
          affectedItems: [current.itemCode],
          affectedFormulas: []
        });
        setMessage(`Change request created for ${current.itemCode}.`);
      } else if (action === "checkout") {
        await api.post(`/items/${current.id}/check-out`);
        setMessage(`Item ${current.itemCode} checked out.`);
        await queryClient.invalidateQueries({ queryKey: ["item-detail", itemId] });
      } else if (action === "checkin") {
        await api.post(`/items/${current.id}/check-in`);
        setMessage(`Item ${current.itemCode} checked in.`);
        await queryClient.invalidateQueries({ queryKey: ["item-detail", itemId] });
      } else if (action === "copy") {
        await api.post(`/items/${current.id}/copy`);
        setMessage(`Copy created for ${current.itemCode}.`);
      } else if (action === "revise") {
        await api.post(`/items/${current.id}/revise`);
        setMessage(`Revision created for ${current.itemCode}.`);
      } else if (action === "delete") {
        if (!window.confirm(`Delete item ${current.itemCode}?`)) {
          return;
        }
        await api.delete(`/items/${current.id}`);
        setMessage(`Item ${current.itemCode} deleted.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    }
  }

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-slate-100 p-2">
            {item.data ? <EntityIcon kind="item" variant={item.data.itemType} size={20} /> : null}
          </div>
          <div>
            <p className="font-mono text-sm text-slate-500">{item.data?.itemCode}</p>
            <h2 className="font-heading text-xl">{item.data?.name}</h2>
            <p className="text-sm text-slate-500">
              {item.data?.itemType} | {item.data?.uom} | {item.data?.status}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ObjectActionsMenu onAction={(action) => void runItemAction(action)} actions={itemActions} />
          <Link to="/items" className="rounded border border-slate-300 bg-white px-3 py-1 text-sm">
            Back to Items
          </Link>
        </div>
      </div>

      {message ? <p className="rounded border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">{message}</p> : null}

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
          Specifications
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("workflow")}
          className={`px-3 py-2 ${activeTab === "workflow" ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`}
        >
          Workflow
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
          You are viewing an old version of this item. Use the History tab to navigate to the latest version.
        </div>
      ) : null}

      {activeTab === "details" ? (
        <div className="space-y-3">
          {isEditingItem ? (
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-medium">Edit Attributes</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateItem.mutate()}
                    disabled={updateItem.isPending}
                    className="rounded bg-primary px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                  >
                    {updateItem.isPending ? "Saving..." : "Save"}
                  </button>
                  <button type="button" onClick={() => setIsEditingItem(false)} className="rounded border border-slate-300 px-3 py-1 text-xs">
                    Cancel
                  </button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <FloatingInput label="Name" value={itemDraft.name} onChange={(event) => setItemDraft({ ...itemDraft, name: event.target.value })} />
                <FloatingInput label="Description" value={itemDraft.description} onChange={(event) => setItemDraft({ ...itemDraft, description: event.target.value })} />
                <FloatingSelect label="UOM" value={itemDraft.uom} onChange={(event) => setItemDraft({ ...itemDraft, uom: event.target.value })}>
                  {(uomsQuery.data?.data ?? STANDARD_UOMS).map((uom) => (
                    <option key={uom.value} value={uom.value}>
                      {uom.label}
                    </option>
                  ))}
                </FloatingSelect>
                <FloatingInput label="Density (g/cm3)" value={itemDraft.density} onChange={(event) => setItemDraft({ ...itemDraft, density: event.target.value })} />
                <FloatingInput label="Viscosity (cP)" value={itemDraft.viscosity} onChange={(event) => setItemDraft({ ...itemDraft, viscosity: event.target.value })} />
                <FloatingInput label="pH" value={itemDraft.pH} onChange={(event) => setItemDraft({ ...itemDraft, pH: event.target.value })} />
                <FloatingInput label="Flash Point (C)" value={itemDraft.flashPoint} onChange={(event) => setItemDraft({ ...itemDraft, flashPoint: event.target.value })} />
                <FloatingInput label="CAS Number" value={itemDraft.casNumber} onChange={(event) => setItemDraft({ ...itemDraft, casNumber: event.target.value })} />
                <FloatingInput label="REACH Registration" value={itemDraft.reachRegistration} onChange={(event) => setItemDraft({ ...itemDraft, reachRegistration: event.target.value })} />
                <FloatingInput label="GHS Classification" value={itemDraft.ghsClassification} onChange={(event) => setItemDraft({ ...itemDraft, ghsClassification: event.target.value })} />
                <FloatingInput label="Boiling Point (C)" value={itemDraft.boilingPoint} onChange={(event) => setItemDraft({ ...itemDraft, boilingPoint: event.target.value })} />
              </div>
              {attributeDefinitions.length ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium uppercase text-slate-500">Custom Attributes</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {attributeDefinitions.map((definition) => (
                      <FloatingInput
                        key={definition.key}
                        label={definition.label}
                        value={itemDraft.customAttributes[definition.key] ?? ""}
                        onChange={(event) =>
                          setItemDraft({
                            ...itemDraft,
                            customAttributes: { ...itemDraft.customAttributes, [definition.key]: event.target.value }
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium">Attributes</p>
                <button
                  type="button"
                  onClick={() => setIsEditingItem(true)}
                  disabled={!canEdit}
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-xs disabled:opacity-60"
                >
                  Edit Details
                </button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded bg-white px-2 py-1">
                  <span className="text-xs text-slate-500">Description</span>
                  <p className="text-sm text-slate-700">{formatAttributeValue(item.data?.description)}</p>
                </div>
                <div className="rounded bg-white px-2 py-1">
                  <span className="text-xs text-slate-500">Regulatory Flags</span>
                  <p className="text-sm text-slate-700">{activeRegulatoryFlags.length ? activeRegulatoryFlags.join(", ") : "None"}</p>
                </div>
                <div className="rounded bg-white px-2 py-1">
                  <span className="text-xs text-slate-500">Density</span>
                  <p className="text-sm text-slate-700">
                    {formatAttributeValue(item.data?.density)} {item.data?.density ? densityUnit : ""}
                  </p>
                </div>
                <div className="rounded bg-white px-2 py-1">
                  <span className="text-xs text-slate-500">Viscosity</span>
                  <p className="text-sm text-slate-700">
                    {formatAttributeValue(item.data?.viscosity)} {item.data?.viscosity ? viscosityUnit : ""}
                  </p>
                </div>
                <div className="rounded bg-white px-2 py-1">
                  <span className="text-xs text-slate-500">pH</span>
                  <p className="text-sm text-slate-700">
                    {formatAttributeValue(item.data?.pH)} {item.data?.pH ? phUnit : ""}
                  </p>
                </div>
                <div className="rounded bg-white px-2 py-1">
                  <span className="text-xs text-slate-500">Flash Point</span>
                  <p className="text-sm text-slate-700">
                    {formatAttributeValue(item.data?.flashPoint)} {item.data?.flashPoint ? flashPointUnit : ""}
                  </p>
                </div>
                <div className="rounded bg-white px-2 py-1">
                  <span className="text-xs text-slate-500">CAS Number</span>
                  <p className="text-sm text-slate-700">{formatAttributeValue(attributes.casNumber)}</p>
                </div>
                <div className="rounded bg-white px-2 py-1">
                  <span className="text-xs text-slate-500">REACH Registration</span>
                  <p className="text-sm text-slate-700">{formatAttributeValue(attributes.reachRegistration)}</p>
                </div>
                <div className="rounded bg-white px-2 py-1">
                  <span className="text-xs text-slate-500">GHS Classification</span>
                  <p className="text-sm text-slate-700">{formatAttributeValue(attributes.ghsClassification)}</p>
                </div>
                <div className="rounded bg-white px-2 py-1">
                  <span className="text-xs text-slate-500">Boiling Point</span>
                  <p className="text-sm text-slate-700">{formatAttributeValue(attributes.boilingPoint)}</p>
                </div>
              </div>
              {attributeDefinitions.length || Object.keys(customAttributes).length ? (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-medium uppercase text-slate-500">Custom Attributes</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {(attributeDefinitions.length ? attributeDefinitions : Object.keys(customAttributes).map((key) => ({ key, label: key, type: "text", required: false }))).map((definition) => (
                      <div key={definition.key} className="rounded bg-white px-2 py-1">
                        <span className="text-xs text-slate-500">{definition.label}</span>
                        <p className="text-sm text-slate-700">{formatAttributeValue(customAttributes[definition.key])}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="mb-1 font-medium">Used In Formulas</p>
              {links.data?.formulaUsages.map((usage) => (
                <Link key={usage.id} to={`/formulas/${usage.formula.id}`} className="block text-primary hover:underline">
                  {usage.formula.formulaCode} v{usage.formula.version} - {usage.formula.name}
                </Link>
              ))}
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="mb-1 font-medium">Used In BOMs</p>
              {links.data?.bomUsages.map((usage) => (
                <Link key={usage.id} to={`/bom/${usage.bom.id}`} className="block text-primary hover:underline">
                  {usage.bom.bomCode} v{usage.bom.version} ({usage.bom.type})
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">Related Documents</p>
              <Link to="/documents" className="text-xs text-primary hover:underline">
                Manage documents
              </Link>
            </div>
            <div className="mb-3 rounded border border-slate-200 bg-white p-2">
              <label className="text-[11px] font-medium uppercase text-slate-500">Link Document</label>
              <input
                value={docSearch}
                onChange={(event) => setDocSearch(event.target.value)}
                placeholder="Search documents by name or number"
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
              />
              {docSearch.trim().length > 1 ? (
                <div className="mt-2 space-y-1">
                  {documentSearch.isLoading ? (
                    <p className="text-xs text-slate-500">Searching documents...</p>
                  ) : documentSearch.data?.data?.length ? (
                    documentSearch.data.data.map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => linkDocument.mutate(doc.id)}
                        className="flex w-full items-center justify-between rounded border border-slate-200 px-2 py-1 text-left text-xs hover:border-primary"
                      >
                        <span>
                          <span className="font-mono">{doc.docNumber}</span> {doc.name}
                        </span>
                        <span className="text-[10px] uppercase text-slate-500">
                          {doc.docType} • {doc.status}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">No documents found.</p>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Type at least 2 characters to search.</p>
              )}
            </div>
            {documents.isLoading ? (
              <p className="text-slate-500">Loading documents...</p>
            ) : documents.data?.data?.length ? (
              <div className="overflow-hidden rounded border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-[11px] uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Document</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">File</th>
                      <th className="px-3 py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.data.data.map((doc) => (
                      <tr key={doc.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <Link to={`/documents/${doc.id}`} className="text-primary hover:underline">
                            {doc.docNumber}
                          </Link>
                          <div className="text-[11px] text-slate-500">{doc.name}</div>
                        </td>
                        <td className="px-3 py-2">{doc.docType}</td>
                        <td className="px-3 py-2">{doc.status}</td>
                        <td className="px-3 py-2">
                          <a href={`/api/documents/${doc.id}/download`} className="text-primary hover:underline">
                            {doc.fileName}
                          </a>
                        </td>
                        <td className="px-3 py-2">{new Date(doc.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500">No documents linked to this item.</p>
            )}
          </div>
        </div>
      ) : activeTab === "specs" ? (
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
                disabled={!canEdit}
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
                {item.data?.industryType === "FOOD_BEVERAGE" ? (
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
          ) : links.data?.specifications?.length ? (
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
                  {links.data.specifications.map((spec) => (
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
      ) : activeTab === "workflow" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="mb-1 font-medium">Change Requests</p>
            {links.data?.relatedChanges.length ? (
              links.data.relatedChanges.map((change) => (
                <Link key={change.id} to={`/changes/${change.id}`} className="block text-primary hover:underline">
                  {change.crNumber}: {change.title} ({change.status})
                </Link>
              ))
            ) : (
              <p className="text-slate-500">No change requests linked.</p>
            )}
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="mb-1 font-medium">Workflow Status</p>
            {links.data?.workflows.length ? (
              links.data.workflows.map((wf) => (
                <p key={wf.id} className="text-slate-600">
                  Workflow: {wf.currentState}
                </p>
              ))
            ) : (
              <p className="text-slate-500">No active workflow.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="mb-2 font-medium">Item Version History</p>
          {history.data?.history?.length ? (
            <div className="space-y-2">
              {history.data.history.map((entry) => (
                <Link
                  key={entry.id}
                  to={`/items/${entry.id}`}
                  className={`block rounded border px-3 py-2 ${
                    entry.id === itemId ? "border-primary bg-white" : "border-slate-200 bg-white hover:border-primary"
                  }`}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono">{entry.itemCode}</span>
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
