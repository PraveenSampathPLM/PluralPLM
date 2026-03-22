import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  ArrowLeft, RefreshCw, TestTube2, Plus, Trash2,
  CheckCircle2, XCircle, CircleDashed, AlertCircle,
  ChevronDown, ChevronRight, Loader2, Activity,
  GitCompare, History, Settings2, Zap
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────
   Types
────────────────────────────────────────────────────────────── */
interface ErpIntegration {
  id: string; name: string; description?: string; erpType: string;
  status: string; baseUrl: string; authType: string;
  syncEntities: string[]; syncSchedule?: string; lastSyncAt?: string;
  credentials: Record<string, string>; containerId?: string;
}

interface ErpFieldMapping {
  id: string; entityType: string; direction: string;
  plmField: string; erpField: string; transformRule?: string; required: boolean;
}

interface ErpSyncLog {
  id: string; direction: string; entityType: string; status: string;
  recordsTotal: number; recordsSynced: number; recordsFailed: number;
  errorMessage?: string; triggeredBy?: string;
  startedAt: string; completedAt?: string;
}

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { Icon: typeof CheckCircle2; cls: string; label: string }> = {
    ACTIVE:   { Icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-50 border-emerald-200", label: "Active"   },
    INACTIVE: { Icon: CircleDashed, cls: "text-slate-500  bg-slate-50  border-slate-200",    label: "Inactive" },
    ERROR:    { Icon: XCircle,      cls: "text-red-600    bg-red-50    border-red-200",       label: "Error"    },
  };
  const cfg = map[status] ?? { Icon: AlertCircle, cls: "text-amber-600 bg-amber-50 border-amber-200", label: status };
  const Icon = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
      <Icon size={11} strokeWidth={2.2} />{cfg.label}
    </span>
  );
}

function SyncStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    SUCCESS: "text-emerald-700 bg-emerald-50 border-emerald-200",
    PARTIAL: "text-amber-700   bg-amber-50   border-amber-200",
    FAILED:  "text-red-700     bg-red-50     border-red-200",
    RUNNING: "text-blue-700    bg-blue-50    border-blue-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${map[status] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
      {status === "RUNNING" && <Loader2 size={10} className="animate-spin" />}
      {status}
    </span>
  );
}

function durationStr(start: string, end?: string) {
  const ms = new Date(end ?? Date.now()).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m`;
}

const ENTITY_TYPES = ["ITEM", "FORMULA", "FG_STRUCTURE"] as const;
const DIRECTIONS   = ["PLM_TO_ERP", "ERP_TO_PLM", "BIDIRECTIONAL"] as const;
const PLM_FIELDS   = [
  "itemCode","name","description","itemType","lifecycleStatus","uom","revision",
  "formulaCode","batchSize","yield","version",
  "structureCode","outputItem",
];

/* ──────────────────────────────────────────────────────────────
   Tabs
────────────────────────────────────────────────────────────── */
type Tab = "overview" | "mappings" | "logs" | "settings";
const TABS: { id: Tab; label: string; Icon: typeof Activity }[] = [
  { id: "overview",  label: "Overview",       Icon: Activity    },
  { id: "mappings",  label: "Field Mappings",  Icon: GitCompare  },
  { id: "logs",      label: "Sync History",    Icon: History     },
  { id: "settings",  label: "Settings",        Icon: Settings2   },
];

/* ──────────────────────────────────────────────────────────────
   Overview tab
────────────────────────────────────────────────────────────── */
function OverviewTab({ intg, onSync, onTest, syncing, testing }: {
  intg: ErpIntegration;
  onSync: (entityType: string) => void;
  onTest: () => void;
  syncing: boolean; testing: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Last Sync", value: intg.lastSyncAt ? new Date(intg.lastSyncAt).toLocaleString() : "Never" },
          { label: "ERP System", value: intg.erpType.replace("_", " ") },
          { label: "Schedule",   value: intg.syncSchedule ?? "Manual only" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Sync entities */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Sync Entities</h3>
        </div>
        <div className="mt-4 space-y-3">
          {intg.syncEntities.map((entity) => (
            <div key={entity} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-primary" />
                <span className="text-sm font-medium text-slate-700">{entity}</span>
              </div>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => onSync(entity)}
                  disabled={syncing}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
                  {syncing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  Push to ERP
                </button>
                <button type="button"
                  onClick={() => onSync(entity)}
                  disabled={syncing}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-50">
                  Pull from ERP
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Connection test */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-800">Connection Health</h3>
        <p className="mt-1 text-sm text-slate-500">Test the connection to verify credentials and network access.</p>
        <div className="mt-3 flex items-center gap-3">
          <button type="button"
            onClick={onTest}
            disabled={testing}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {testing ? <Loader2 size={14} className="animate-spin" /> : <TestTube2 size={14} />}
            Test Connection
          </button>
          <StatusBadge status={intg.status} />
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Mappings tab
────────────────────────────────────────────────────────────── */
function MappingsTab({ integrationId }: { integrationId: string }) {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["erp-mappings", integrationId],
    queryFn: async () => (await api.get<{ data: ErpFieldMapping[] }>(`/integrations/${integrationId}/mappings`)).data,
  });

  const [rows, setRows] = useState<Omit<ErpFieldMapping, "id">[]>([]);
  const [initialised, setInitialised] = useState(false);

  if (data && !initialised) {
    setRows(data.data.map(({ id: _id, ...rest }) => rest));
    setInitialised(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/integrations/${integrationId}/mappings`, { mappings: rows }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["erp-mappings", integrationId] }); toast.success("Mappings saved"); },
    onError: () => toast.error("Failed to save mappings"),
  });

  function addRow() {
    setRows((prev) => [...prev, { entityType: "ITEM", direction: "PLM_TO_ERP", plmField: "itemCode", erpField: "", required: false }]);
  }

  function updateRow(i: number, key: keyof Omit<ErpFieldMapping, "id">, val: string | boolean) {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  const grouped = ENTITY_TYPES.map((et) => ({ entityType: et, rows: rows.map((r, i) => ({ ...r, idx: i })).filter((r) => r.entityType === et) }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Define how PLM fields map to ERP fields. Default mappings are seeded for your ERP type.</p>
        <div className="flex gap-2">
          <button type="button" onClick={addRow}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
            <Plus size={13} /> Add Row
          </button>
          <button type="button" onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
            {saveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
            Save Mappings
          </button>
        </div>
      </div>

      {grouped.map((group) => group.rows.length === 0 ? null : (
        <div key={group.entityType} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            <span className="text-xs font-semibold text-slate-600">{group.entityType}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {["PLM Field", "Direction", "ERP Field", "Transform Rule", "Required", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {group.rows.map((row) => (
                <tr key={row.idx} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2">
                    <select value={row.plmField} onChange={(e) => updateRow(row.idx, "plmField", e.target.value)}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs">
                      {PLM_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select value={row.direction} onChange={(e) => updateRow(row.idx, "direction", e.target.value)}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs">
                      {DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input value={row.erpField} onChange={(e) => updateRow(row.idx, "erpField", e.target.value)}
                      className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs" placeholder="ERP field name" />
                  </td>
                  <td className="px-4 py-2">
                    <input value={row.transformRule ?? ""} onChange={(e) => updateRow(row.idx, "transformRule", e.target.value)}
                      className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs" placeholder="e.g. toUpperCase()" />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input type="checkbox" checked={row.required} onChange={(e) => updateRow(row.idx, "required", e.target.checked)}
                      className="h-3.5 w-3.5 rounded accent-primary" />
                  </td>
                  <td className="px-4 py-2">
                    <button type="button" onClick={() => removeRow(row.idx)} className="text-slate-300 hover:text-red-400">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Unmapped rows (any entity) */}
      {rows.some((r) => !ENTITY_TYPES.includes(r.entityType as typeof ENTITY_TYPES[number])) && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            <span className="text-xs font-semibold text-slate-600">Other</span>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-50">
              {rows.map((row, idx) => ENTITY_TYPES.includes(row.entityType as typeof ENTITY_TYPES[number]) ? null : (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2">
                    <select value={row.entityType} onChange={(e) => updateRow(idx, "entityType", e.target.value)}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs">
                      {["ITEM","FORMULA","FG_STRUCTURE","CHANGE","RELEASE"].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input value={row.plmField} onChange={(e) => updateRow(idx, "plmField", e.target.value)}
                      className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs" placeholder="PLM field" />
                  </td>
                  <td className="px-4 py-2">
                    <select value={row.direction} onChange={(e) => updateRow(idx, "direction", e.target.value)}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs">
                      {DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input value={row.erpField} onChange={(e) => updateRow(idx, "erpField", e.target.value)}
                      className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs" placeholder="ERP field" />
                  </td>
                  <td className="px-4 py-2">
                    <button type="button" onClick={() => removeRow(idx)} className="text-slate-300 hover:text-red-400">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No field mappings. Click "Add Row" to define how PLM fields map to ERP fields.
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Logs tab
────────────────────────────────────────────────────────────── */
function LogsTab({ integrationId }: { integrationId: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["erp-sync-logs", integrationId],
    queryFn: async () => (await api.get<{ data: ErpSyncLog[] }>(`/integrations/${integrationId}/logs`)).data,
    refetchInterval: 5000,
  });

  const logs = data?.data ?? [];

  if (isLoading) return <div className="py-12 text-center text-sm text-slate-500">Loading…</div>;
  if (logs.length === 0) return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-sm text-slate-500">
      No sync history yet. Trigger a sync to see logs here.
    </div>
  );

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="rounded-xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setExpanded(expanded === log.id ? null : log.id)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-3">
              <SyncStatusBadge status={log.status} />
              <span className="text-sm font-medium text-slate-700">{log.direction} · {log.entityType}</span>
              <span className="text-xs text-slate-400">{new Date(log.startedAt).toLocaleString()}</span>
              {log.completedAt && <span className="text-xs text-slate-400">({durationStr(log.startedAt, log.completedAt)})</span>}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-3 text-xs text-slate-500">
                <span className="text-emerald-600 font-medium">{log.recordsSynced} synced</span>
                {log.recordsFailed > 0 && <span className="text-red-600 font-medium">{log.recordsFailed} failed</span>}
                <span>{log.recordsTotal} total</span>
              </div>
              {expanded === log.id ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
            </div>
          </button>
          {expanded === log.id && (
            <div className="border-t border-slate-100 px-4 py-3">
              {log.errorMessage && (
                <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{log.errorMessage}</div>
              )}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div><p className="text-slate-400">Triggered by</p><p className="font-medium text-slate-700">{log.triggeredBy ?? "—"}</p></div>
                <div><p className="text-slate-400">Started</p><p className="font-medium text-slate-700">{new Date(log.startedAt).toLocaleString()}</p></div>
                <div><p className="text-slate-400">Completed</p><p className="font-medium text-slate-700">{log.completedAt ? new Date(log.completedAt).toLocaleString() : "Running…"}</p></div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Settings tab
────────────────────────────────────────────────────────────── */
function SettingsTab({ intg }: { intg: ErpIntegration }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: intg.name, description: intg.description ?? "", baseUrl: intg.baseUrl, syncSchedule: intg.syncSchedule ?? "" });

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/integrations/${intg.id}`, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["erp-integration", intg.id] }); toast.success("Settings saved"); },
    onError: () => toast.error("Failed to save settings"),
  });

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Integration Name</label>
        <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
        <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Base URL</label>
        <input value={form.baseUrl} onChange={(e) => setForm((p) => ({ ...p, baseUrl: e.target.value }))}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Sync Schedule (cron)</label>
        <input value={form.syncSchedule} onChange={(e) => setForm((p) => ({ ...p, syncSchedule: e.target.value }))}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="e.g. 0 2 * * * (2am daily)" />
        <p className="mt-1 text-[10px] text-slate-400">Leave blank for manual sync only.</p>
      </div>
      <button type="button" onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
        {saveMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
        Save Settings
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Main detail page
────────────────────────────────────────────────────────────── */
export function IntegrationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");

  const { data: intg, isLoading } = useQuery({
    queryKey: ["erp-integration", id],
    queryFn: async () => (await api.get<ErpIntegration>(`/integrations/${id}`)).data,
  });

  const testMutation = useMutation({
    mutationFn: () => api.post<{ success: boolean; message: string; latencyMs?: number }>(`/integrations/${id}/test`, {}),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["erp-integration", id] });
      if (res.data.success) toast.success(`Connected — ${res.data.latencyMs ?? 0}ms`);
      else toast.error(`Connection failed: ${res.data.message}`);
    },
    onError: () => toast.error("Connection test failed"),
  });

  const syncMutation = useMutation({
    mutationFn: (entityType: string) => api.post(`/integrations/${id}/sync`, { entityType, direction: "PUSH" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["erp-sync-logs", id] }); toast.success("Sync started"); },
    onError: () => toast.error("Sync failed"),
  });

  if (isLoading) return <div className="py-20 text-center text-sm text-slate-500">Loading…</div>;
  if (!intg) return <div className="py-20 text-center text-sm text-slate-500">Integration not found.</div>;

  return (
    <div className="space-y-5">
      {/* Breadcrumb + header */}
      <div className="flex items-start justify-between">
        <div>
          <Link to="/integrations" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary">
            <ArrowLeft size={13} /> All Integrations
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="font-heading text-xl font-bold text-slate-900">{intg.name}</h1>
            <StatusBadge status={intg.status} />
          </div>
          {intg.description && <p className="mt-0.5 text-sm text-slate-500">{intg.description}</p>}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {testMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <TestTube2 size={13} />} Test
          </button>
          <button type="button" onClick={() => syncMutation.mutate(intg.syncEntities[0] ?? "ITEM")}
            disabled={syncMutation.isPending}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
            {syncMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Sync Now
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 w-fit">
        {TABS.map(({ id: tabId, label, Icon }) => (
          <button
            key={tabId} type="button"
            onClick={() => setTab(tabId)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === tabId ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Icon size={14} strokeWidth={1.8} />{label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === "overview"  && <OverviewTab  intg={intg} onSync={syncMutation.mutate} onTest={() => testMutation.mutate()} syncing={syncMutation.isPending} testing={testMutation.isPending} />}
        {tab === "mappings"  && <MappingsTab  integrationId={intg.id} />}
        {tab === "logs"      && <LogsTab      integrationId={intg.id} />}
        {tab === "settings"  && <SettingsTab  intg={intg} />}
      </div>
    </div>
  );
}
