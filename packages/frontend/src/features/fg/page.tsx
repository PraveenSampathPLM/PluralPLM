import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { ObjectActionsMenu, type ObjectActionKey } from "@/components/object-actions-menu";
import { useContainerStore } from "@/store/container.store";
import { STANDARD_UOMS } from "@/lib/uom";
import { EntityIcon } from "@/components/entity-icon";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "sonner";

interface PackagingLine {
  lineNumber?: number;
  itemId: string;
  quantity: number;
  uom: string;
  item?: { id: string; itemCode: string; name: string };
}

interface FGRecord {
  id: string;
  version: number;
  revisionLabel: string;
  status: string;
  effectiveDate: string | null;
  updatedAt: string;
  fgItem: { id: string; itemCode: string; name: string; itemType: string };
  formula: { id: string; formulaCode: string; version: number; name: string; status: string } | null;
  packagingLines: PackagingLine[];
}

interface FGListResponse {
  data: FGRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface PackagingLineRow {
  lineNumber: string;
  itemId: string;
  quantity: string;
  uom: string;
}

export function FgPage(): JSX.Element {
  const { selectedContainerId } = useContainerStore();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement | null>(null);
  const createPanelRef = useRef<HTMLDivElement | null>(null);
  const [selectedFgId, setSelectedFgId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    fgItemId: "",
    formulaId: "",
    containerId: selectedContainerId,
    effectiveDate: ""
  });
  const [packagingLines, setPackagingLines] = useState<PackagingLineRow[]>([]);

  const items = useQuery({
    queryKey: ["fg-item-options"],
    queryFn: async () =>
      (await api.get<{ data: Array<{ id: string; itemCode: string; name: string; itemType: string }> }>("/items", { params: { pageSize: 200 } })).data
  });

  const formulas = useQuery({
    queryKey: ["fg-formula-options"],
    queryFn: async () =>
      (await api.get<{ data: Array<{ id: string; formulaCode: string; version: number; name: string }> }>("/formulas", { params: { pageSize: 200 } })).data
  });

  const uomsQuery = useQuery({
    queryKey: ["config-uoms"],
    queryFn: async () => (await api.get<{ data: Array<{ value: string; label: string; category: string }> }>("/config/uoms")).data,
    retry: false
  });

  const { data, isLoading } = useQuery({
    queryKey: ["fg", search, page, selectedContainerId],
    queryFn: async () =>
      (
        await api.get<FGListResponse>("/fg", {
          params: { ...(selectedContainerId ? { containerId: selectedContainerId } : {}), search, page, pageSize: 10 }
        })
      ).data
  });

  const selectedFg = useQuery({
    queryKey: ["fg-details", selectedFgId],
    queryFn: async () => (await api.get<FGRecord>(`/fg/${selectedFgId}`)).data,
    enabled: Boolean(selectedFgId)
  });

  const fgItemOptions = items.data?.data.filter((item) => item.itemType === "FINISHED_GOOD") ?? [];
  const packagingItemOptions = items.data?.data.filter((item) => item.itemType === "PACKAGING") ?? [];

  const createFg = useMutation({
    mutationFn: async () => {
      if (!form.fgItemId) throw new Error("Select a Finished Good item.");
      if (!form.formulaId) throw new Error("Select a formula.");

      const mappedLines = packagingLines
        .filter((row) => row.itemId && row.quantity)
        .map((row, idx) => ({
          ...(row.lineNumber ? { lineNumber: Number(row.lineNumber) } : { lineNumber: (idx + 1) * 10 }),
          itemId: row.itemId,
          quantity: Number(row.quantity),
          uom: row.uom || "ea"
        }));

      await api.post("/fg", {
        fgItemId: form.fgItemId,
        formulaId: form.formulaId,
        containerId: selectedContainerId || form.containerId || undefined,
        effectiveDate: form.effectiveDate || undefined,
        packagingLines: mappedLines
      });
    },
    onSuccess: async () => {
      toast.success("Finished Good structure created successfully.");
      setForm({ fgItemId: "", formulaId: "", containerId: selectedContainerId, effectiveDate: "" });
      setPackagingLines([]);
      await queryClient.invalidateQueries({ queryKey: ["fg"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Create failed");
    }
  });

  async function runFgAction(fg: FGRecord, action: ObjectActionKey): Promise<void> {
    try {
      if (action === "checkout") {
        await api.post(`/fg/${fg.id}/check-out`);
        toast.success(`${fg.fgItem.itemCode} v${fg.version} checked out.`);
      } else if (action === "checkin") {
        await api.post(`/fg/${fg.id}/check-in`);
        toast.success(`${fg.fgItem.itemCode} v${fg.version} checked in.`);
      } else if (action === "copy") {
        await api.post(`/fg/${fg.id}/copy`);
        toast.success(`Copy created for ${fg.fgItem.itemCode}.`);
      } else if (action === "revise") {
        await api.post(`/fg/${fg.id}/revise`);
        toast.success(`Revision created for ${fg.fgItem.itemCode}.`);
      } else if (action === "delete") {
        if (!window.confirm(`Delete Finished Good structure ${fg.fgItem.itemCode} v${fg.version}?`)) {
          return;
        }
        await api.delete(`/fg/${fg.id}`);
        if (selectedFgId === fg.id) {
          setSelectedFgId("");
        }
        toast.success(`${fg.fgItem.itemCode} v${fg.version} deleted.`);
      }
      await queryClient.invalidateQueries({ queryKey: ["fg"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
  }

  function addPackagingLine(): void {
    setPackagingLines((prev) => [
      ...prev,
      { lineNumber: String((prev.length + 1) * 10), itemId: "", quantity: "", uom: "ea" }
    ]);
  }

  function updateLine(index: number, patch: Partial<PackagingLineRow>): void {
    setPackagingLines((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeLine(index: number): void {
    setPackagingLines((prev) => prev.filter((_, i) => i !== index));
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
        setForm({ fgItemId: "", formulaId: "", containerId: selectedContainerId, effectiveDate: "" });
        setPackagingLines([]);
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
          + Create Finished Good Structure
        </button>
      </div>

      {createOpen ? (
      <div ref={createPanelRef} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 font-heading text-lg">Create Finished Good Structure</h3>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Finished Good Item</label>
            <select
              value={form.fgItemId}
              onChange={(e) => setForm({ ...form, fgItemId: e.target.value })}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select FG Item</option>
              {fgItemOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.itemCode} — {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Formula</label>
            <select
              value={form.formulaId}
              onChange={(e) => setForm({ ...form, formulaId: e.target.value })}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select Formula</option>
              {formulas.data?.data.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.formulaCode} v{f.version} — {f.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Effective Date</label>
            <input
              type="date"
              value={form.effectiveDate}
              onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Packaging Components</p>
            <button type="button" onClick={addPackagingLine} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">
              Add Packaging
            </button>
          </div>
          {packagingLines.length > 0 && (
            <div className="overflow-x-auto rounded border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-2 py-2">Line #</th>
                    <th className="px-2 py-2">Packaging Item</th>
                    <th className="px-2 py-2">Quantity</th>
                    <th className="px-2 py-2">UOM</th>
                    <th className="px-2 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {packagingLines.map((row, index) => (
                    <tr key={`pkg-${index}`} className="border-b border-slate-100">
                      <td className="px-2 py-2">
                        <input value={row.lineNumber} onChange={(e) => updateLine(index, { lineNumber: e.target.value })} className="w-16 rounded border border-slate-300 px-2 py-1 text-sm" />
                      </td>
                      <td className="px-2 py-2">
                        <select value={row.itemId} onChange={(e) => updateLine(index, { itemId: e.target.value })} className="w-full rounded border border-slate-300 px-2 py-1 text-sm">
                          <option value="">Select</option>
                          {packagingItemOptions.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.itemCode} — {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input value={row.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} className="w-24 rounded border border-slate-300 px-2 py-1 text-sm" />
                      </td>
                      <td className="px-2 py-2">
                        <select value={row.uom} onChange={(e) => updateLine(index, { uom: e.target.value })} className="w-20 rounded border border-slate-300 px-2 py-1 text-sm">
                          {(uomsQuery.data?.data ?? STANDARD_UOMS).map((uom) => (
                            <option key={uom.value} value={uom.value}>{uom.value}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <button type="button" onClick={() => removeLine(index)} className="rounded border border-slate-300 px-2 py-1 text-xs">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => createFg.mutate()}
            disabled={createFg.isPending}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {createFg.isPending ? "Creating..." : "Create Finished Good Structure"}
          </button>
        </div>
      </div>
      ) : null}

      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl">Finished Good Management</h2>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search finished goods"
          className="w-64 rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {isLoading ? (
        <p>Loading Finished Good structures...</p>
      ) : (
        <>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="w-10 py-2"> </th>
              <th className="py-2">FG Item</th>
              <th className="py-2">Formula</th>
              <th className="py-2">Version</th>
              <th className="py-2">Revision</th>
              <th className="py-2">Status</th>
              <th className="py-2">Packaging</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.data ?? []).map((fg) => (
              <tr key={fg.id} className="border-b border-slate-100">
                <td className="py-2 text-slate-500">
                  <EntityIcon kind="bom" />
                </td>
                <td className="py-2 font-mono">
                  <Link to={`/fg/${fg.id}`} className="text-primary hover:underline">
                    {fg.fgItem.itemCode}
                  </Link>
                  <span className="ml-1 text-slate-500 font-sans font-normal text-xs">{fg.fgItem.name}</span>
                </td>
                <td className="py-2">
                  {fg.formula ? (
                    <Link to={`/formulas/${fg.formula.id}`} className="text-primary hover:underline">
                      {fg.formula.formulaCode} v{fg.formula.version}
                    </Link>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="py-2">v{fg.version}</td>
                <td className="py-2">{fg.revisionLabel}</td>
                <td className="py-2"><StatusBadge status={fg.status} /></td>
                <td className="py-2">{fg.packagingLines.length} item{fg.packagingLines.length !== 1 ? "s" : ""}</td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFgId(fg.id)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    Quick View
                  </button>
                  <Link to={`/fg/${fg.id}`} className="ml-2 rounded border border-slate-300 px-2 py-1 text-xs">
                    Open
                  </Link>
                  <span className="ml-2 inline-block">
                    <ObjectActionsMenu
                      onAction={(action) => void runFgAction(fg, action)}
                      actions={[
                        { key: "checkout", label: "Check Out", disabled: fg.status !== "IN_WORK" },
                        { key: "checkin", label: "Check In", disabled: fg.status !== "UNDER_REVIEW" },
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
        {(data?.data ?? []).length === 0 && !isLoading ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            <p className="font-medium">No finished goods found</p>
            <p className="mt-1 text-xs">{search ? "Try a different search term" : "Click \"+ Create Finished Good Structure\" above to get started"}</p>
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

      {selectedFgId ? (
        <div className="fixed inset-0 z-40 flex">
          <button type="button" className="h-full flex-1 bg-black/30" onClick={() => setSelectedFgId("")} aria-label="Close panel" />
          <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-heading text-lg">Finished Good Quick View</h3>
              <button type="button" onClick={() => setSelectedFgId("")} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">
                Close
              </button>
            </div>
            {selectedFg.isLoading ? (
              <p>Loading...</p>
            ) : selectedFg.data ? (
              <div className="space-y-3">
                <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-medium">{selectedFg.data.fgItem.itemCode} — {selectedFg.data.fgItem.name}</p>
                  <p className="text-slate-500">v{selectedFg.data.version} · Rev {selectedFg.data.revisionLabel} · {selectedFg.data.status}</p>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="mb-2 font-medium">Linked Formula</p>
                  {selectedFg.data.formula ? (
                    <Link to={`/formulas/${selectedFg.data.formula.id}`} className="text-primary hover:underline">
                      {selectedFg.data.formula.formulaCode} v{selectedFg.data.formula.version} — {selectedFg.data.formula.name}
                    </Link>
                  ) : (
                    <p className="text-slate-400">No formula linked</p>
                  )}
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="mb-2 font-medium">Packaging Components ({selectedFg.data.packagingLines.length})</p>
                  {selectedFg.data.packagingLines.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="border-b border-slate-200 text-slate-600">
                        <tr>
                          <th className="px-1 py-1 text-left">Line</th>
                          <th className="px-1 py-1 text-left">Item</th>
                          <th className="px-1 py-1 text-left">Qty</th>
                          <th className="px-1 py-1 text-left">UOM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedFg.data.packagingLines.map((line, idx) => (
                          <tr key={`${line.itemId}-${idx}`} className="border-b border-slate-100">
                            <td className="px-1 py-1">{line.lineNumber ?? idx + 1}</td>
                            <td className="px-1 py-1">
                              {line.item ? (
                                <Link to={`/items/${line.item.id}`} className="text-primary hover:underline">
                                  {line.item.itemCode} — {line.item.name}
                                </Link>
                              ) : null}
                            </td>
                            <td className="px-1 py-1">{line.quantity}</td>
                            <td className="px-1 py-1">{line.uom}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-slate-400">No packaging components</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
