import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useContainerStore } from "@/store/container.store";
import { EntityIcon } from "@/components/entity-icon";
import { StatusBadge } from "@/components/status-badge";
import { FloatingInput, FloatingSelect } from "@/components/floating-field";
import { ObjectActionsMenu, type ObjectActionKey } from "@/components/object-actions-menu";
import { toast } from "sonner";

interface ArtworkListRow {
  id: string;
  artworkCode: string;
  title: string;
  containerId?: string | null;
  brand?: string | null;
  market?: string | null;
  status: string;
  revisionLabel: string;
  fgItem?: { id: string; itemCode: string; name: string } | null;
  formula?: { id: string; formulaCode: string; version: number; name: string } | null;
  _count?: { components: number; files: number; approvals: number };
  updatedAt: string;
}

interface ArtworkListResponse {
  data: ArtworkListRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface ArtworkDashboardResponse {
  kpis: { total: number; released: number; review: number; draft: number };
  byStatus: Array<{ status: string; count: number }>;
  monthlyTrend: Array<{ month: string; created: number; released: number }>;
}

export function ArtworksPage(): JSX.Element {
  const currentUserRole = (JSON.parse(localStorage.getItem("plm_user") || "{}") as { role?: string }).role ?? "";
  const isAdmin = ["System Admin", "PLM Admin", "Container Admin"].includes(currentUserRole);
  const { selectedContainerId } = useContainerStore();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const fromItemId = searchParams.get("fromItemId") ?? "";
  const fromItemCode = searchParams.get("fromItemCode") ?? "";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [createOpen, setCreateOpen] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement | null>(null);
  const createPanelRef = useRef<HTMLDivElement | null>(null);
  const [form, setForm] = useState({
    title: "",
    brand: "",
    packSize: "",
    market: "",
    legalCopy: "",
    warnings: "",
    storageConditions: "",
    usageInstructions: "",
    claims: "",
    fgItemId: fromItemId,
    packagingItemId: "",
    formulaId: "",
    releaseRequestId: "",
    languageSet: ""
  });

  // Auto-open create panel when arriving from Digital Thread
  useEffect(() => {
    if (fromItemId) {
      setCreateOpen(true);
      setForm((prev) => ({ ...prev, fgItemId: fromItemId }));
    }
  }, [fromItemId]);

  const dashboard = useQuery({
    queryKey: ["artworks-dashboard", selectedContainerId],
    queryFn: async () =>
      (
        await api.get<ArtworkDashboardResponse>("/artworks/dashboard", {
          params: { ...(selectedContainerId ? { containerId: selectedContainerId } : {}) }
        })
      ).data
  });

  const artworks = useQuery({
    queryKey: ["artworks", search, status, page, selectedContainerId],
    queryFn: async () =>
      (
        await api.get<ArtworkListResponse>("/artworks", {
          params: {
            search,
            status: status || undefined,
            page,
            pageSize: 10,
            ...(selectedContainerId ? { containerId: selectedContainerId } : {})
          }
        })
      ).data
  });

  const itemOptions = useQuery({
    queryKey: ["artwork-item-options", selectedContainerId],
    queryFn: async () =>
      (
        await api.get<{ data: Array<{ id: string; itemCode: string; name: string; itemType: string }> }>("/items", {
          params: { pageSize: 200, ...(selectedContainerId ? { containerId: selectedContainerId } : {}) }
        })
      ).data
  });

  const formulaOptions = useQuery({
    queryKey: ["artwork-formula-options", selectedContainerId],
    queryFn: async () =>
      (
        await api.get<{ data: Array<{ id: string; formulaCode: string; version: number; name: string }> }>("/formulas", {
          params: { pageSize: 200, ...(selectedContainerId ? { containerId: selectedContainerId } : {}) }
        })
      ).data
  });

  const releaseOptions = useQuery({
    queryKey: ["artwork-release-options", selectedContainerId],
    queryFn: async () =>
      (
        await api.get<{ data: Array<{ id: string; rrNumber: string; title: string }> }>("/releases", {
          params: { pageSize: 200, ...(selectedContainerId ? { containerId: selectedContainerId } : {}) }
        })
      ).data
  });

  const createArtwork = useMutation({
    mutationFn: async () => {
      const claims = form.claims
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      const languageSet = form.languageSet
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      await api.post("/artworks", {
        title: form.title,
        brand: form.brand || undefined,
        packSize: form.packSize || undefined,
        market: form.market || undefined,
        legalCopy: form.legalCopy || undefined,
        warnings: form.warnings || undefined,
        storageConditions: form.storageConditions || undefined,
        usageInstructions: form.usageInstructions || undefined,
        claims: claims.length ? claims : undefined,
        languageSet: languageSet.length ? languageSet : undefined,
        fgItemId: form.fgItemId || undefined,
        packagingItemId: form.packagingItemId || undefined,
        formulaId: form.formulaId || undefined,
        releaseRequestId: form.releaseRequestId || undefined,
        containerId: selectedContainerId || undefined
      });
    },
    onSuccess: async () => {
      toast.success("Artwork created.");
      setForm({
        title: "",
        brand: "",
        packSize: "",
        market: "",
        legalCopy: "",
        warnings: "",
        storageConditions: "",
        usageInstructions: "",
        claims: "",
        fgItemId: "",
        packagingItemId: "",
        formulaId: "",
        releaseRequestId: "",
        languageSet: ""
      });
      await queryClient.invalidateQueries({ queryKey: ["artworks"] });
      await queryClient.invalidateQueries({ queryKey: ["artworks-dashboard"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Create failed")
  });

  useEffect(() => {
    setPage(1);
  }, [search, status, selectedContainerId]);

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
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [createOpen]);

  function handleSort(key: string): void {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortHeader({ label, colKey }: { label: string; colKey: string }) {
    const active = sortKey === colKey;
    return (
      <button type="button" onClick={() => handleSort(colKey)} className="flex items-center gap-1 text-left font-medium hover:text-primary">
        {label}
        <span className="text-[10px] text-slate-400">{active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}</span>
      </button>
    );
  }

  const total = artworks.data?.total ?? 0;
  const pageSize = artworks.data?.pageSize ?? 10;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const sortedArtworks = (() => {
    const rows = artworks.data?.data ?? [];
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const aVal = String((a as any)[sortKey] ?? "").toLowerCase();
      const bVal = String((b as any)[sortKey] ?? "").toLowerCase();
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  })();

  function exportCsv(): void {
    if (!sortedArtworks.length) return;
    const headers = ["artworkCode", "title", "market", "language", "status", "version", "createdAt"];
    const csv = [
      headers.join(","),
      ...sortedArtworks.map((row) =>
        headers
          .map((h) => {
            const val = String((row as any)[h] ?? "").replace(/"/g, '""');
            return val.includes(",") || val.includes('"') ? `"${val}"` : val;
          })
          .join(",")
      )
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "artworks-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const artworkActions: Array<{ key: ObjectActionKey; label: string; disabled?: boolean; danger?: boolean }> = [
    { key: "create_release", label: "Create Release" },
    { key: "create_change", label: "Create Change" },
    { key: "checkout", label: "Check Out" },
    { key: "checkin", label: "Check In" },
    { key: "revise", label: "Revise" },
    { key: "copy", label: "Copy" },
    ...(isAdmin ? [{ key: "delete" as ObjectActionKey, label: "Delete", danger: true }] : [])
  ];

  async function runArtworkAction(row: ArtworkListRow, action: ObjectActionKey): Promise<void> {
    try {
      if (action === "create_release") {
        await api.post("/releases", {
          title: `Release ${row.artworkCode}`,
          description: `Release request created from artwork ${row.artworkCode} - ${row.title}.`,
          containerId: selectedContainerId || row.containerId || undefined,
          targetItems: row.fgItem?.id ? [row.fgItem.id] : [],
          targetFormulas: row.formula?.id ? [row.formula.id] : [],
          status: "NEW"
        });
        toast.success(`Release request created for ${row.artworkCode}.`);
      } else if (action === "create_change") {
        await api.post("/changes", {
          title: `Change for ${row.artworkCode}`,
          description: `Change request created from artwork ${row.artworkCode} - ${row.title}.`,
          containerId: selectedContainerId || row.containerId || undefined,
          type: "DCO",
          priority: "MEDIUM",
          status: "NEW",
          affectedItems: row.fgItem?.itemCode ? [row.fgItem.itemCode] : [],
          affectedFormulas: row.formula?.formulaCode ? [row.formula.formulaCode] : []
        });
        toast.success(`Change request created for ${row.artworkCode}.`);
      } else if (action === "checkout") {
        await api.post(`/artworks/${row.id}/check-out`);
        toast.success(`Artwork ${row.artworkCode} checked out.`);
      } else if (action === "checkin") {
        await api.post(`/artworks/${row.id}/check-in`);
        toast.success(`Artwork ${row.artworkCode} checked in.`);
      } else if (action === "revise") {
        await api.post(`/artworks/${row.id}/revise`);
        toast.success(`Revision created for ${row.artworkCode}.`);
      } else if (action === "copy") {
        await api.post(`/artworks/${row.id}/copy`);
        toast.success(`Copy created for ${row.artworkCode}.`);
      } else if (action === "delete") {
        if (!window.confirm(`Delete artwork ${row.artworkCode}?`)) {
          return;
        }
        await api.delete(`/artworks/${row.id}`);
        toast.success(`Artwork ${row.artworkCode} deleted.`);
      }
      await queryClient.invalidateQueries({ queryKey: ["artworks"] });
      await queryClient.invalidateQueries({ queryKey: ["artworks-dashboard"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.");
    }
  }

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Total Artworks</p>
          <p className="text-2xl font-semibold text-primary">{dashboard.data?.kpis.total ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">In Review</p>
          <p className="text-2xl font-semibold text-amber-600">{dashboard.data?.kpis.review ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Released</p>
          <p className="text-2xl font-semibold text-emerald-600">{dashboard.data?.kpis.released ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Draft</p>
          <p className="text-2xl font-semibold text-slate-700">{dashboard.data?.kpis.draft ?? 0}</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <button
          ref={createButtonRef}
          type="button"
          onClick={() => setCreateOpen((prev) => !prev)}
          className="w-full rounded-lg border border-primary bg-primary px-4 py-3 text-left text-sm font-semibold text-white shadow-sm transition hover:bg-[#174766]"
        >
          + Create Artwork
        </button>
      </div>

      {createOpen ? (
        <div ref={createPanelRef} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-3 font-heading text-lg">Create Artwork</h3>
          {fromItemId && fromItemCode ? (
            <div className="mb-3 flex items-center gap-2 rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
              <span>🔗</span>
              <span>This artwork will be automatically linked to <strong>{fromItemCode}</strong></span>
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-4">
            <FloatingInput label="Title *" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            <FloatingInput label="Brand" value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
            <FloatingInput label="Pack Size" value={form.packSize} onChange={(event) => setForm({ ...form, packSize: event.target.value })} />
            <FloatingInput label="Market/Country" value={form.market} onChange={(event) => setForm({ ...form, market: event.target.value })} />
            <FloatingInput label="Language Set (comma-separated)" value={form.languageSet} onChange={(event) => setForm({ ...form, languageSet: event.target.value })} />
            <FloatingInput label="Claims (comma-separated)" value={form.claims} onChange={(event) => setForm({ ...form, claims: event.target.value })} />
            <FloatingInput label="Warnings" value={form.warnings} onChange={(event) => setForm({ ...form, warnings: event.target.value })} />
            <FloatingInput label="Storage Conditions" value={form.storageConditions} onChange={(event) => setForm({ ...form, storageConditions: event.target.value })} />
            <FloatingInput label="Usage Instructions" value={form.usageInstructions} onChange={(event) => setForm({ ...form, usageInstructions: event.target.value })} />
            <FloatingInput label="Legal Copy" value={form.legalCopy} onChange={(event) => setForm({ ...form, legalCopy: event.target.value })} />
            <FloatingSelect label="FG Item Link" value={form.fgItemId} onChange={(event) => setForm({ ...form, fgItemId: event.target.value })}>
              <option value="">None</option>
              {(itemOptions.data?.data ?? [])
                .filter((item) => item.itemType === "FINISHED_GOOD")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.itemCode} - {item.name}
                  </option>
                ))}
            </FloatingSelect>
            <FloatingSelect label="Packaging Item Link" value={form.packagingItemId} onChange={(event) => setForm({ ...form, packagingItemId: event.target.value })}>
              <option value="">None</option>
              {(itemOptions.data?.data ?? [])
                .filter((item) => item.itemType === "PACKAGING")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.itemCode} - {item.name}
                  </option>
                ))}
            </FloatingSelect>
            <FloatingSelect label="Formula Link" value={form.formulaId} onChange={(event) => setForm({ ...form, formulaId: event.target.value })}>
              <option value="">None</option>
              {(formulaOptions.data?.data ?? []).map((formula) => (
                <option key={formula.id} value={formula.id}>
                  {formula.formulaCode} v{formula.version} - {formula.name}
                </option>
              ))}
            </FloatingSelect>
            <FloatingSelect label="Release Link" value={form.releaseRequestId} onChange={(event) => setForm({ ...form, releaseRequestId: event.target.value })}>
              <option value="">None</option>
              {(releaseOptions.data?.data ?? []).map((release) => (
                <option key={release.id} value={release.id}>
                  {release.rrNumber} - {release.title}
                </option>
              ))}
            </FloatingSelect>
          </div>
          <button
            type="button"
            onClick={() => createArtwork.mutate()}
            disabled={!form.title || createArtwork.isPending}
            className="mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {createArtwork.isPending ? "Creating..." : "Create Artwork"}
          </button>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl">Artwork Management</h2>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search code/title"
            className="w-64 rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded border border-slate-300 px-2 py-2 text-sm">
            <option value="">All Statuses</option>
            <option value="DRAFT">DRAFT</option>
            <option value="REVIEW">REVIEW</option>
            <option value="APPROVED">APPROVED</option>
            <option value="RELEASED">RELEASED</option>
            <option value="OBSOLETE">OBSOLETE</option>
          </select>
        </div>
      </div>

      {artworks.isLoading ? (
        <p>Loading artworks...</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="w-10 py-2"> </th>
              <th className="py-2"><SortHeader label="Artwork #" colKey="artworkCode" /></th>
              <th className="py-2"><SortHeader label="Title" colKey="title" /></th>
              <th className="py-2"><SortHeader label="Market" colKey="market" /></th>
              <th className="py-2">Linked Product</th>
              <th className="py-2"><SortHeader label="Status" colKey="status" /></th>
              <th className="py-2">Components</th>
              <th className="py-2">Open</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedArtworks.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="py-2 text-slate-500">
                  <EntityIcon kind="artwork" />
                </td>
                <td className="py-2 font-mono">
                  <Link to={`/artworks/${row.id}`} className="text-primary hover:underline">
                    {row.artworkCode}
                  </Link>
                </td>
                <td className="py-2">
                  <p className="font-medium text-slate-800">{row.title}</p>
                  <p className="text-xs text-slate-500">
                    {row.brand ?? "No brand"} · Rev {row.revisionLabel}
                  </p>
                </td>
                <td className="py-2">{row.market ?? "—"}</td>
                <td className="py-2 text-xs text-slate-600">
                  {row.fgItem ? (
                    <Link to={`/items/${row.fgItem.id}`} className="font-mono text-primary hover:underline">
                      {row.fgItem.itemCode} — {row.fgItem.name}
                    </Link>
                  ) : row.formula ? (
                    <Link to={`/formulas/${row.formula.id}`} className="font-mono text-primary hover:underline">
                      {row.formula.formulaCode} v{row.formula.version}
                    </Link>
                  ) : "—"}
                </td>
                <td className="py-2">
                  <StatusBadge status={row.status} />
                </td>
                <td className="py-2 text-xs text-slate-600">{row._count?.components ?? 0}</td>
                <td className="py-2">
                  <Link to={`/artworks/${row.id}`} className="rounded border border-slate-300 px-2 py-1 text-xs">
                    Open
                  </Link>
                </td>
                <td className="py-2 text-right">
                  <ObjectActionsMenu onAction={(action) => void runArtworkAction(row, action)} actions={artworkActions} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex items-center justify-between text-sm text-slate-600">
        <div className="flex items-center gap-3">
          <p>Artworks: {total} records</p>
          <button
            type="button"
            onClick={exportCsv}
            disabled={sortedArtworks.length === 0}
            title="Export current page to CSV"
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-60"
          >
            ↓ Export CSV
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((previous) => Math.max(1, previous - 1))}
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
            onClick={() => setPage((previous) => Math.min(pageCount, previous + 1))}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-60"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
