import { useState } from "react";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { ObjectActionsMenu, type ObjectActionKey } from "@/components/object-actions-menu";
import { useContainerStore } from "@/store/container.store";
import { FloatingInput, FloatingSelect } from "@/components/floating-field";
import { STANDARD_UOMS } from "@/lib/uom";
import { EntityIcon } from "@/components/entity-icon";

interface Item {
  id: string;
  itemCode: string;
  revisionLabel: string;
  name: string;
  itemType: string;
  uom: string;
  status: string;
  updatedAt: string;
}

interface ItemListResponse {
  data: Item[];
  total: number;
  page: number;
  pageSize: number;
}

interface ConfigResponse {
  listColumns: {
    ITEM: string[];
  };
  attributeDefinitions: {
    ITEM: Array<{ key: string; label: string; type: "text" | "number" | "boolean"; required: boolean }>;
  };
}

interface ItemLinksResponse {
  item: { id: string; itemCode: string; name: string };
  formulaUsages: Array<{
    id: string;
    quantity: number;
    uom: string;
    percentage?: number | null;
    formula: { id: string; formulaCode: string; version: number; name: string; status: string };
  }>;
  bomUsages: Array<{
    id: string;
    quantity: number;
    uom: string;
    bom: { id: string; bomCode: string; version: number; type: string; formula?: { formulaCode: string; version: number; name: string } | null };
  }>;
  specifications: Array<{ id: string; specType: string; attribute: string; value?: string | null; minValue?: number | null; maxValue?: number | null; uom?: string | null }>;
  relatedChanges: Array<{ id: string; crNumber: string; title: string; status: string }>;
  workflows: Array<{ id: string; currentState: string }>;
}
interface ContainerOption {
  id: string;
  code: string;
  name: string;
}

interface UomResponse {
  data: Array<{ value: string; label: string; category: string }>;
}

export function ItemsPage(): JSX.Element {
  const { selectedContainerId } = useContainerStore();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"FG" | "FORMULA" | "RM" | "PKG">("FG");
  const [page, setPage] = useState(1);
  const [selectedItemId, setSelectedItemId] = useState("");
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string>("");
  const [form, setForm] = useState({
    itemCode: "",
    name: "",
    itemType: "RAW_MATERIAL",
    uom: "kg",
    casNumber: "",
    reachRegistration: "",
    ghsClassification: "",
    flashPoint: "",
    containerId: selectedContainerId,
    customAttributes: {} as Record<string, string | boolean>
  });
  const containers = useQuery({
    queryKey: ["item-container-options"],
    queryFn: async () => (await api.get<{ data: ContainerOption[] }>("/containers")).data
  });

  const config = useQuery({
    queryKey: ["item-config"],
    queryFn: async () => (await api.get<ConfigResponse>("/config")).data
  });
  const uomsQuery = useQuery({
    queryKey: ["config-uoms"],
    queryFn: async () => (await api.get<UomResponse>("/config/uoms")).data,
    retry: false
  });

  const itemNumberEntity =
    form.itemType === "FINISHED_GOOD" ? "ITEM_FINISHED_GOOD" : form.itemType === "PACKAGING" ? "ITEM_PACKAGING" : "ITEM";
  const nextNumber = useQuery({
    queryKey: ["next-item-number", itemNumberEntity],
    queryFn: async () => (await api.get<{ value: string }>(`/config/next-number/${itemNumberEntity}`)).data
  });

  const itemTypeForTab = activeTab === "FG" ? "FINISHED_GOOD" : activeTab === "PKG" ? "PACKAGING" : activeTab === "RM" ? "RAW_MATERIAL" : "";

  const itemsQuery = useQuery({
    queryKey: ["items", activeTab, search, page, selectedContainerId],
    queryFn: async () =>
      (
        await api.get<ItemListResponse>("/items", {
          params: {
            search,
            page,
            pageSize: 10,
            ...(itemTypeForTab ? { itemType: itemTypeForTab } : {}),
            ...(selectedContainerId ? { containerId: selectedContainerId } : {})
          }
        })
      ).data
  });

  const formulasQuery = useQuery({
    queryKey: ["recipes", search, page, selectedContainerId],
    queryFn: async () =>
      (
        await api.get<{ data: any[]; total: number; page: number; pageSize: number }>("/formulas", {
          params: { page, pageSize: 10, ...(selectedContainerId ? { containerId: selectedContainerId } : {}) }
        })
      ).data,
    enabled: activeTab === "FORMULA"
  });

  const itemLinks = useQuery({
    queryKey: ["item-links", selectedItemId],
    queryFn: async () => (await api.get<ItemLinksResponse>(`/items/${selectedItemId}/links`)).data,
    enabled: Boolean(selectedItemId)
  });

  const createItem = useMutation({
    mutationFn: async () => {
      if (!selectedContainerId) {
        throw new Error("Select a container before creating items.");
      }
      const definitions = config.data?.attributeDefinitions.ITEM ?? [];
      const customAttributes: Record<string, string | number | boolean | null> = {};

      for (const definition of definitions) {
        const raw = form.customAttributes[definition.key];
        if (definition.type === "boolean") {
          customAttributes[definition.key] = Boolean(raw);
          continue;
        }

        const text = String(raw ?? "").trim();
        if (!text) {
          if (definition.required) {
            throw new Error(`${definition.label} is required`);
          }
          continue;
        }

        if (definition.type === "number") {
          const parsed = Number(text);
          if (!Number.isFinite(parsed)) {
            throw new Error(`${definition.label} must be a valid number`);
          }
          customAttributes[definition.key] = parsed;
        } else {
          customAttributes[definition.key] = text;
        }
      }

      await api.post("/items", {
        itemCode: form.itemCode || undefined,
        name: form.name,
        itemType: form.itemType,
        uom: form.uom,
        casNumber: form.casNumber || undefined,
        reachRegistration: form.reachRegistration || undefined,
        ghsClassification: form.ghsClassification || undefined,
        flashPoint: form.flashPoint ? Number(form.flashPoint) : undefined,
        containerId: selectedContainerId,
        customAttributes
      });
    },
    onSuccess: async () => {
      setMessage("Item created successfully.");
      setForm({
        itemCode: "",
        name: "",
        itemType: "RAW_MATERIAL",
        uom: "kg",
        casNumber: "",
        reachRegistration: "",
        ghsClassification: "",
        flashPoint: "",
        containerId: selectedContainerId,
        customAttributes: {}
      });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["next-item-number"] });
    },
    onError: (error) => {
      const text = error instanceof Error ? error.message : "Create failed";
      setMessage(text);
    }
  });

  async function runItemAction(item: Item, action: ObjectActionKey): Promise<void> {
    try {
      if (action === "create_release") {
        await api.post("/releases", {
          title: `Release ${item.itemCode}`,
          description: `Release request created from ${item.itemCode} - ${item.name}.`,
          containerId: selectedContainerId || undefined,
          targetItems: [item.id],
          targetBoms: [],
          targetFormulas: [],
          status: "NEW"
        });
        setMessage(`Release request created for ${item.itemCode}.`);
      } else if (action === "create_change") {
        await api.post("/changes", {
          title: `Change for ${item.itemCode}`,
          description: `Change request created from ${item.itemCode} - ${item.name}.`,
          containerId: selectedContainerId || undefined,
          type: "ECR",
          priority: "MEDIUM",
          status: "NEW",
          affectedItems: [item.itemCode],
          affectedFormulas: []
        });
        setMessage(`Change request created for ${item.itemCode}.`);
      } else if (action === "checkout") {
        await api.post(`/items/${item.id}/check-out`);
        setMessage(`Item ${item.itemCode} checked out.`);
      } else if (action === "checkin") {
        await api.post(`/items/${item.id}/check-in`);
        setMessage(`Item ${item.itemCode} checked in.`);
      } else if (action === "copy") {
        await api.post(`/items/${item.id}/copy`);
        setMessage(`Copy created for ${item.itemCode}.`);
      } else if (action === "revise") {
        await api.post(`/items/${item.id}/revise`);
        setMessage(`Revision created for ${item.itemCode}.`);
      } else if (action === "delete") {
        if (!window.confirm(`Delete item ${item.itemCode}?`)) {
          return;
        }
        await api.delete(`/items/${item.id}`);
        if (selectedItemId === item.id) {
          setSelectedItemId("");
        }
        setMessage(`Item ${item.itemCode} deleted.`);
      }
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["next-item-number"] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    }
  }

  const itemActions: Array<{ key: ObjectActionKey; label: string; disabled?: boolean; danger?: boolean }> = [
    { key: "create_release", label: "Create Release" },
    { key: "create_change", label: "Create Change" },
    { key: "checkout", label: "Check Out" },
    { key: "checkin", label: "Check In" },
    { key: "revise", label: "Revise" },
    { key: "copy", label: "Copy" },
    { key: "delete", label: "Delete", danger: true }
  ];

  const itemColumnDefs: Record<string, { label: string; render: (item: Item) => string }> = {
    itemCode: { label: "Code", render: (item) => item.itemCode },
    revisionLabel: { label: "Revision", render: (item) => item.revisionLabel ?? "1.1" },
    name: { label: "Name", render: (item) => item.name },
    itemType: { label: "Type", render: (item) => item.itemType },
    uom: { label: "UOM", render: (item) => item.uom },
    status: { label: "Status", render: (item) => item.status },
    updatedAt: { label: "Updated", render: (item) => new Date(item.updatedAt).toLocaleDateString() }
  };
  const configuredColumns = (config.data?.listColumns?.ITEM ?? ["itemCode", "revisionLabel", "name", "status"]).filter((key) =>
    Boolean(itemColumnDefs[key])
  );

  const listTitle =
    activeTab === "FG"
      ? "Finished Goods"
      : activeTab === "PKG"
        ? "Packaging"
        : activeTab === "RM"
          ? "Raw Materials"
          : "Formulations";

  const pagedData = activeTab === "FORMULA" ? formulasQuery.data?.data ?? [] : itemsQuery.data?.data ?? [];
  const total = activeTab === "FORMULA" ? formulasQuery.data?.total ?? 0 : itemsQuery.data?.total ?? 0;
  const pageSize = activeTab === "FORMULA" ? formulasQuery.data?.pageSize ?? 10 : itemsQuery.data?.pageSize ?? 10;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [activeTab, search, selectedContainerId]);

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-1 font-heading text-lg">Create Material</h3>
        <p className="mb-3 text-xs text-slate-500">If Item Code is blank, auto-numbering will use: {nextNumber.data?.value ?? "Loading..."}</p>

        <div className="grid gap-3 md:grid-cols-4">
          <FloatingInput label="Item Code" value={form.itemCode} onChange={(event) => setForm({ ...form, itemCode: event.target.value })} />
          <FloatingInput label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <FloatingSelect label="Item Type" value={form.itemType} onChange={(event) => setForm({ ...form, itemType: event.target.value })}>
            <option value="RAW_MATERIAL">Raw Material</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="FINISHED_GOOD">Finished Good</option>
            <option value="PACKAGING">Packaging</option>
          </FloatingSelect>
          <FloatingSelect label="UOM" value={form.uom} onChange={(event) => setForm({ ...form, uom: event.target.value })}>
            {Array.from(new Set((uomsQuery.data?.data ?? STANDARD_UOMS).map((uom) => uom.category))).map((category) => (
              <optgroup key={category} label={category}>
                {(uomsQuery.data?.data ?? STANDARD_UOMS).filter((uom) => uom.category === category).map((uom) => (
                  <option key={uom.value} value={uom.value}>
                    {uom.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </FloatingSelect>
          <FloatingInput label="CAS Number" value={form.casNumber} onChange={(event) => setForm({ ...form, casNumber: event.target.value })} />
          <FloatingInput label="REACH Registration" value={form.reachRegistration} onChange={(event) => setForm({ ...form, reachRegistration: event.target.value })} />
          <FloatingInput label="GHS Classification" value={form.ghsClassification} onChange={(event) => setForm({ ...form, ghsClassification: event.target.value })} />
          <FloatingInput label="Flash Point" value={form.flashPoint} onChange={(event) => setForm({ ...form, flashPoint: event.target.value })} />
          <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            Active Container: {containers.data?.data.find((c) => c.id === selectedContainerId)?.code ?? "All Accessible"}
          </div>

          {config.data?.attributeDefinitions.ITEM.map((attribute) => (
            <div key={attribute.key}>
              {attribute.type === "boolean" ? (
                <label className="flex h-full items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(form.customAttributes[attribute.key])}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        customAttributes: { ...form.customAttributes, [attribute.key]: event.target.checked }
                      })
                    }
                  />
                  {attribute.label}
                </label>
              ) : (
                <FloatingInput
                  label={`${attribute.label}${attribute.required ? " *" : ""}`}
                  value={String(form.customAttributes[attribute.key] ?? "")}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      customAttributes: {
                        ...form.customAttributes,
                        [attribute.key]: event.target.value
                      }
                    })
                  }
                />
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => createItem.mutate()}
          disabled={!form.name || createItem.isPending}
          className="mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {createItem.isPending ? "Creating..." : "Create Item"}
        </button>

        {message ? <p className="mt-2 text-sm text-slate-700">{message}</p> : null}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl">Materials & Recipes</h2>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search code or name"
          className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-2">
        {([
          ["FG", "Finished Goods"],
          ["FORMULA", "Formulations"],
          ["RM", "Raw Materials"],
          ["PKG", "Packaging"]
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`rounded px-3 py-2 text-sm ${activeTab === key ? "bg-primary text-white" : "border border-slate-300 bg-white text-slate-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {(activeTab === "FORMULA" ? formulasQuery.isLoading : itemsQuery.isLoading) ? (
        <p>Loading {listTitle.toLowerCase()}...</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              {activeTab === "FORMULA" ? (
                <>
                  <th className="w-10 py-2"> </th>
                  <th className="py-2">Code</th>
                  <th className="py-2">Name</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Output</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Actions</th>
                </>
              ) : (
                <>
                  <th className="w-10 py-2"> </th>
                  {configuredColumns.map((columnKey) => (
                    <th key={columnKey} className="py-2">
                      {itemColumnDefs[columnKey]?.label ?? columnKey}
                    </th>
                  ))}
                  <th className="py-2">Actions</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {activeTab === "FORMULA"
              ? pagedData.map((formula: any) => (
                  <tr key={formula.id} className="border-b border-slate-100">
                    <td className="py-2 text-slate-500">
                      <EntityIcon kind="formula" />
                    </td>
                    <td className="py-2 font-mono">
                      <Link to={`/formulas/${formula.id}`} className="text-primary hover:underline">
                        {formula.formulaCode}
                      </Link>
                    </td>
                    <td className="py-2">{formula.name}</td>
                    <td className="py-2">{formula.recipeType === "FINISHED_GOOD_RECIPE" ? "Finished Good" : "Formula"}</td>
                    <td className="py-2">
                      {formula.recipeType === "FINISHED_GOOD_RECIPE"
                        ? `${formula.outputItem?.itemCode ?? "N/A"}`
                        : "Formula"}
                    </td>
                    <td className="py-2">{formula.status}</td>
                    <td className="py-2">
                      <Link to={`/formulas/${formula.id}`} className="rounded border border-slate-300 px-2 py-1 text-xs">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              : pagedData.map((item: Item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-2 text-slate-500">
                      <EntityIcon kind="item" variant={item.itemType} />
                    </td>
                    {configuredColumns.map((columnKey) => {
                      const value = itemColumnDefs[columnKey]?.render(item) ?? "";
                      const isCode = columnKey === "itemCode";
                      return (
                        <td
                          key={`${item.id}-${columnKey}`}
                          className={`py-2 ${isCode ? "font-mono" : ""}`}
                        >
                          {isCode ? (
                            <Link to={`/items/${item.id}`} className="text-primary hover:underline">
                              {value}
                            </Link>
                          ) : (
                            value
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2">
                      <Link to={`/items/${item.id}`} className="rounded border border-slate-300 px-2 py-1 text-xs">
                        Open
                      </Link>
                      <button type="button" onClick={() => setSelectedItemId(item.id)} className="ml-2 rounded border border-slate-300 px-2 py-1 text-xs">
                        Links
                      </button>
                      <span className="ml-2">
                        <ObjectActionsMenu onAction={(action) => void runItemAction(item, action)} actions={itemActions} />
                      </span>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      )}

      <div className="flex items-center justify-between text-sm text-slate-600">
        <p>
          {listTitle}: {total} records
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-60"
          >
            Prev
          </button>
          <span>
            Page {page} / {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-60"
          >
            Next
          </button>
        </div>
      </div>

      {selectedItemId ? (
        <div className="fixed inset-0 z-40 flex">
          <button type="button" className="h-full flex-1 bg-black/30" onClick={() => setSelectedItemId("")} aria-label="Close panel" />
          <div className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-heading text-lg">Item Linkage</h3>
              <button type="button" onClick={() => setSelectedItemId("")} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">
                Close
              </button>
            </div>
            {itemLinks.isLoading ? (
              <p className="text-sm text-slate-500">Loading linkage...</p>
            ) : (
              <div className="space-y-3">
                <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="mb-2 font-medium">Used In Formulations ({itemLinks.data?.formulaUsages.length ?? 0})</p>
                  <div className="space-y-1 text-slate-600">
                    {itemLinks.data?.formulaUsages.map((usage) => (
                      <Link key={usage.id} to={`/formulas/${usage.formula.id}`} className="block text-primary hover:underline">
                        {usage.formula.formulaCode} v{usage.formula.version} - {usage.formula.name} ({usage.quantity} {usage.uom})
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="mb-2 font-medium">Used In BOMs ({itemLinks.data?.bomUsages.length ?? 0})</p>
                  <div className="space-y-1 text-slate-600">
                    {itemLinks.data?.bomUsages.map((usage) => (
                      <Link key={usage.id} to={`/bom/${usage.bom.id}`} className="block text-primary hover:underline">
                        {usage.bom.bomCode} v{usage.bom.version} ({usage.bom.type}) - {usage.quantity} {usage.uom}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="mb-2 font-medium">Specifications ({itemLinks.data?.specifications.length ?? 0})</p>
                  <div className="space-y-1 text-slate-600">
                    {itemLinks.data?.specifications.map((spec) => (
                      <p key={spec.id}>
                        {spec.specType}: {spec.attribute} [{spec.minValue ?? spec.value ?? "N/A"} - {spec.maxValue ?? "N/A"} {spec.uom ?? ""}]
                      </p>
                    ))}
                  </div>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="mb-2 font-medium">Changes / Workflows</p>
                  <div className="space-y-1 text-slate-600">
                    {itemLinks.data?.relatedChanges.map((change) => (
                      <Link key={change.id} to={`/changes/${change.id}`} className="block text-primary hover:underline">
                        {change.crNumber}: {change.title} ({change.status})
                      </Link>
                    ))}
                    {itemLinks.data?.workflows.map((workflow) => (
                      <p key={workflow.id}>Workflow State: {workflow.currentState}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
