import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  Plus, Plug, RefreshCw, Trash2, TestTube2, Settings,
  CheckCircle2, XCircle, CircleDashed, AlertCircle,
  ChevronRight, Zap
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────
   Types
────────────────────────────────────────────────────────────── */
interface ErpIntegration {
  id: string;
  name: string;
  description?: string;
  erpType: string;
  status: "ACTIVE" | "INACTIVE" | "ERROR";
  baseUrl: string;
  authType: string;
  syncEntities: string[];
  lastSyncAt?: string;
  createdAt: string;
  _count: { mappings: number; syncLogs: number };
}

/* ──────────────────────────────────────────────────────────────
   Constants
────────────────────────────────────────────────────────────── */
const ERP_TYPES = [
  { value: "SAP_S4",        label: "SAP S/4HANA",          logo: "SAP",   color: "#0070F2", desc: "OData v4 REST API" },
  { value: "ORACLE_EBS",    label: "Oracle EBS",            logo: "ORC",   color: "#C74634", desc: "REST / SOAP services" },
  { value: "ORACLE_FUSION", label: "Oracle Fusion Cloud",   logo: "OFC",   color: "#C74634", desc: "Oracle Cloud REST API" },
  { value: "DYNAMICS_365",  label: "Microsoft Dynamics 365",logo: "D365",  color: "#00B4F0", desc: "Dataverse OData v4" },
  { value: "NETSUITE",      label: "NetSuite",              logo: "NS",    color: "#009FDA", desc: "SuiteTalk REST" },
  { value: "REST",          label: "Generic REST API",      logo: "REST",  color: "#6366F1", desc: "Custom REST endpoint" },
] as const;

const AUTH_TYPES = [
  { value: "API_KEY", label: "API Key" },
  { value: "BEARER",  label: "Bearer Token" },
  { value: "BASIC",   label: "Basic Auth (user / pass)" },
  { value: "OAUTH2",  label: "OAuth 2.0" },
] as const;

const SYNC_ENTITIES = ["ITEM", "FORMULA", "FG_STRUCTURE", "CHANGE", "RELEASE"] as const;

/* ──────────────────────────────────────────────────────────────
   Status badge
────────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const map = {
    ACTIVE:   { icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-50 border-emerald-200", label: "Active"   },
    INACTIVE: { icon: CircleDashed, cls: "text-slate-500  bg-slate-50  border-slate-200",    label: "Inactive" },
    ERROR:    { icon: XCircle,      cls: "text-red-600    bg-red-50    border-red-200",       label: "Error"    },
  }[status] ?? { icon: AlertCircle, cls: "text-amber-600 bg-amber-50 border-amber-200", label: status };
  const Icon = map.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${map.cls}`}>
      <Icon size={11} strokeWidth={2.2} />
      {map.label}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────
   ERP type badge
────────────────────────────────────────────────────────────── */
function ErpTypeBadge({ erpType }: { erpType: string }) {
  const info = ERP_TYPES.find((t) => t.value === erpType);
  return (
    <span
      className="inline-flex h-7 w-12 items-center justify-center rounded-lg text-[10px] font-bold text-white shadow-sm"
      style={{ backgroundColor: info?.color ?? "#64748b" }}
    >
      {info?.logo ?? erpType}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────
   Create / Edit modal
────────────────────────────────────────────────────────────── */
type FormState = {
  name: string; description: string; erpType: string;
  baseUrl: string; authType: string;
  credentials: Record<string, string>;
  syncEntities: string[]; syncSchedule: string; containerId: string;
};

const emptyForm = (): FormState => ({
  name: "", description: "", erpType: "SAP_S4", baseUrl: "",
  authType: "API_KEY", credentials: {}, syncEntities: ["ITEM"], syncSchedule: "", containerId: "",
});

function IntegrationFormModal({
  initial, onClose, onSave,
}: {
  initial?: FormState;
  onClose: () => void;
  onSave: (data: FormState) => void;
}) {
  const [form, setForm] = useState<FormState>(initial ?? emptyForm());
  const [step, setStep] = useState(0);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function toggleEntity(e: string) {
    set("syncEntities", form.syncEntities.includes(e)
      ? form.syncEntities.filter((x) => x !== e)
      : [...form.syncEntities, e]
    );
  }

  const steps = ["ERP System", "Connection", "Sync Scope"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-semibold text-slate-900">
              {initial ? "Edit Integration" : "New ERP Integration"}
            </h2>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <XCircle size={18} />
            </button>
          </div>
          {/* Steps */}
          <div className="mt-3 flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition ${
                    i === step ? "bg-primary text-white" : i < step ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {i < step ? "✓" : i + 1}
                </button>
                <span className={`text-xs ${i === step ? "font-semibold text-slate-800" : "text-slate-400"}`}>{s}</span>
                {i < steps.length - 1 && <ChevronRight size={12} className="text-slate-300" />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Step 0 — ERP type */}
          {step === 0 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Integration Name *</label>
                <input value={form.name} onChange={(e) => set("name", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="e.g. SAP Production - EMEA" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input value={form.description} onChange={(e) => set("description", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Optional description" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">ERP System *</label>
                <div className="grid grid-cols-2 gap-2">
                  {ERP_TYPES.map((t) => (
                    <button
                      key={t.value} type="button"
                      onClick={() => set("erpType", t.value)}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                        form.erpType === t.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex h-8 w-10 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold text-white shadow-sm"
                        style={{ backgroundColor: t.color }}>{t.logo}</span>
                      <div>
                        <p className="text-xs font-semibold text-slate-800 leading-tight">{t.label}</p>
                        <p className="text-[10px] text-slate-400">{t.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 1 — Connection */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Base URL *</label>
                <input value={form.baseUrl} onChange={(e) => set("baseUrl", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="https://your-erp.example.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Authentication Type *</label>
                <select value={form.authType} onChange={(e) => set("authType", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  {AUTH_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              {form.authType === "API_KEY" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">API Key</label>
                  <input type="password" value={form.credentials.apiKey ?? ""}
                    onChange={(e) => set("credentials", { ...form.credentials, apiKey: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="••••••••••••••••" />
                </div>
              )}
              {form.authType === "BEARER" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bearer Token</label>
                  <input type="password" value={form.credentials.token ?? ""}
                    onChange={(e) => set("credentials", { ...form.credentials, token: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="••••••••••••••••" />
                </div>
              )}
              {(form.authType === "BASIC" || form.authType === "OAUTH2") && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Username / Client ID</label>
                    <input value={form.credentials.username ?? ""}
                      onChange={(e) => set("credentials", { ...form.credentials, username: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Password / Client Secret</label>
                    <input type="password" value={form.credentials.password ?? ""}
                      onChange={(e) => set("credentials", { ...form.credentials, password: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 2 — Sync scope */}
          {step === 2 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Entities to Sync</label>
                <div className="grid grid-cols-2 gap-2">
                  {SYNC_ENTITIES.map((e) => (
                    <button
                      key={e} type="button"
                      onClick={() => toggleEntity(e)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        form.syncEntities.includes(e)
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Zap size={12} />
                      {e.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Sync Schedule (cron)</label>
                <input value={form.syncSchedule} onChange={(e) => set("syncSchedule", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="e.g. 0 2 * * * (2am daily)" />
                <p className="mt-1 text-[10px] text-slate-400">Leave blank for manual sync only.</p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={() => step > 0 ? setStep(step - 1) : onClose()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            {step === 0 ? "Cancel" : "Back"}
          </button>
          <button type="button"
            onClick={() => step < steps.length - 1 ? setStep(step + 1) : onSave(form)}
            disabled={step === 0 && !form.name}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
            {step < steps.length - 1 ? "Next" : initial ? "Save Changes" : "Create Integration"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Main page
────────────────────────────────────────────────────────────── */
export function IntegrationsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["erp-integrations"],
    queryFn: async () => (await api.get<{ data: ErpIntegration[] }>("/integrations")).data,
  });

  const createMutation = useMutation({
    mutationFn: (body: FormState) => api.post("/integrations", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["erp-integrations"] }); setShowModal(false); toast.success("Integration created"); },
    onError: () => toast.error("Failed to create integration"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/integrations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["erp-integrations"] }); toast.success("Integration deleted"); },
    onError: () => toast.error("Failed to delete integration"),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => api.post<{ success: boolean; message: string; latencyMs?: number }>(`/integrations/${id}/test`, {}),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["erp-integrations"] });
      if (res.data.success) toast.success(`Connected — ${res.data.latencyMs ?? 0}ms`);
      else toast.error(`Connection failed: ${res.data.message}`);
    },
    onError: () => toast.error("Connection test failed"),
  });

  const syncMutation = useMutation({
    mutationFn: ({ id, entityType }: { id: string; entityType: string }) =>
      api.post(`/integrations/${id}/sync`, { entityType, direction: "PUSH" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["erp-integrations"] }); toast.success("Sync triggered"); },
    onError: () => toast.error("Sync failed"),
  });

  const integrations = data?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold text-slate-900">ERP Integrations</h1>
          <p className="mt-1 text-sm text-slate-500">
            Connect Tatva to your ERP system to synchronise items, formulas, and BOMs in real time.
          </p>
        </div>
        <button
          type="button" onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
        >
          <Plus size={16} /> New Integration
        </button>
      </div>

      {/* ERP type overview cards */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ERP_TYPES.map((t) => (
          <div key={t.value} className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm">
            <span className="inline-flex h-9 w-14 items-center justify-center rounded-lg text-[11px] font-bold text-white shadow-sm"
              style={{ backgroundColor: t.color }}>{t.logo}</span>
            <p className="mt-2 text-[11px] font-semibold text-slate-700 leading-tight">{t.label}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">{t.desc}</p>
          </div>
        ))}
      </div>

      {/* Integration list */}
      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Loading…</div>
      ) : integrations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Plug size={32} strokeWidth={1.3} className="mx-auto text-slate-300" />
          <p className="mt-3 font-medium text-slate-700">No integrations configured</p>
          <p className="mt-1 text-sm text-slate-500">Connect Tatva to SAP, Oracle, Dynamics, NetSuite, or a custom REST API.</p>
          <button type="button" onClick={() => setShowModal(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
            <Plus size={15} /> New Integration
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {integrations.map((intg) => (
            <div key={intg.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <ErpTypeBadge erpType={intg.erpType} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{intg.name}</h3>
                      <StatusBadge status={intg.status} />
                    </div>
                    {intg.description && <p className="mt-0.5 text-sm text-slate-500">{intg.description}</p>}
                    <p className="mt-1 font-mono text-xs text-slate-400">{intg.baseUrl}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {intg.syncEntities.map((e) => (
                        <span key={e} className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{e}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex gap-1.5 text-[11px] text-slate-400 mr-2">
                    <span>{intg._count.mappings} mappings</span>
                    <span>·</span>
                    <span>{intg._count.syncLogs} syncs</span>
                    {intg.lastSyncAt && <><span>·</span><span>Last: {new Date(intg.lastSyncAt).toLocaleDateString()}</span></>}
                  </div>
                  <button type="button"
                    onClick={() => testMutation.mutate(intg.id)}
                    disabled={testMutation.isPending}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    <TestTube2 size={12} /> Test
                  </button>
                  <button type="button"
                    onClick={() => syncMutation.mutate({ id: intg.id, entityType: intg.syncEntities[0] ?? "ITEM" })}
                    disabled={syncMutation.isPending}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    <RefreshCw size={12} /> Sync Now
                  </button>
                  <Link to={`/integrations/${intg.id}`}
                    className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15">
                    <Settings size={12} /> Configure
                  </Link>
                  <button type="button"
                    onClick={() => { if (confirm(`Delete "${intg.name}"?`)) deleteMutation.mutate(intg.id); }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <IntegrationFormModal
          onClose={() => setShowModal(false)}
          onSave={(data) => createMutation.mutate(data)}
        />
      )}
    </div>
  );
}
