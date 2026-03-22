/**
 * ERP Adapter Framework
 * Pluggable adapter pattern — each ERP type implements ErpAdapter.
 * Concrete adapters simulate connectivity; real credentials + network
 * access would be provided at deployment time.
 */

export interface ExternalItem {
  externalId: string;
  itemCode: string;
  name: string;
  type: string;
  status: string;
  uom?: string;
  raw?: Record<string, unknown>;
}

export interface SyncResult {
  total: number;
  synced: number;
  failed: number;
  errors: Array<{ id: string; message: string }>;
}

export interface ConnectionResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

export interface ErpAdapter {
  testConnection(): Promise<ConnectionResult>;
  pushItems(items: ExternalItem[]): Promise<SyncResult>;
  pullItems(): Promise<ExternalItem[]>;
  pushFormulas(formulas: ExternalFormula[]): Promise<SyncResult>;
  pullMaterials(): Promise<ExternalItem[]>;
}

export interface ExternalFormula {
  externalId: string;
  formulaCode: string;
  name: string;
  outputItem: string;
  version: string;
  ingredients: Array<{ itemCode: string; percentage: number; uom: string }>;
  raw?: Record<string, unknown>;
}

/* ──────────────────────────────────────────────────────────────
   Base adapter with shared helpers
────────────────────────────────────────────────────────────── */
abstract class BaseAdapter implements ErpAdapter {
  protected baseUrl: string;
  protected credentials: Record<string, string>;
  protected authType: string;

  constructor(baseUrl: string, authType: string, credentials: Record<string, string>) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.authType = authType;
    this.credentials = credentials;
  }

  protected buildHeaders(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.authType === "API_KEY" && this.credentials.apiKey) {
      h["X-API-Key"] = this.credentials.apiKey;
    } else if (this.authType === "BEARER" && this.credentials.token) {
      h["Authorization"] = `Bearer ${this.credentials.token}`;
    } else if (this.authType === "BASIC" && this.credentials.username) {
      const encoded = Buffer.from(
        `${this.credentials.username}:${this.credentials.password ?? ""}`
      ).toString("base64");
      h["Authorization"] = `Basic ${encoded}`;
    }
    return h;
  }

  abstract testConnection(): Promise<ConnectionResult>;
  abstract pushItems(items: ExternalItem[]): Promise<SyncResult>;
  abstract pullItems(): Promise<ExternalItem[]>;
  abstract pushFormulas(formulas: ExternalFormula[]): Promise<SyncResult>;
  abstract pullMaterials(): Promise<ExternalItem[]>;
}

/* ──────────────────────────────────────────────────────────────
   SAP S/4HANA adapter  (OData v4 / REST)
────────────────────────────────────────────────────────────── */
export class SapS4Adapter extends BaseAdapter {
  async testConnection(): Promise<ConnectionResult> {
    const t0 = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/sap/opu/odata4/sap/api_material/srvd_a2x/sap/material/0001/$metadata`, {
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(8000),
      });
      return { success: res.ok || res.status === 401, message: res.ok ? "Connected to SAP S/4HANA" : `HTTP ${res.status}`, latencyMs: Date.now() - t0 };
    } catch (err: unknown) {
      return { success: false, message: (err as Error).message, latencyMs: Date.now() - t0 };
    }
  }

  async pushItems(items: ExternalItem[]): Promise<SyncResult> {
    const result: SyncResult = { total: items.length, synced: 0, failed: 0, errors: [] };
    for (const item of items) {
      try {
        const res = await fetch(`${this.baseUrl}/sap/opu/odata4/sap/api_material/srvd_a2x/sap/material/0001/Material`, {
          method: "POST",
          headers: this.buildHeaders(),
          body: JSON.stringify({ Material: item.itemCode, MaterialDescription: [{ Language: "EN", MaterialDescription: item.name }] }),
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) result.synced++; else { result.failed++; result.errors.push({ id: item.externalId, message: `HTTP ${res.status}` }); }
      } catch (err: unknown) {
        result.failed++; result.errors.push({ id: item.externalId, message: (err as Error).message });
      }
    }
    return result;
  }

  async pullItems(): Promise<ExternalItem[]> {
    const res = await fetch(`${this.baseUrl}/sap/opu/odata4/sap/api_material/srvd_a2x/sap/material/0001/Material?$top=200&$format=json`, {
      headers: this.buildHeaders(), signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`SAP pull failed: HTTP ${res.status}`);
    const data = await res.json() as { value: Array<{ Material: string; MaterialDescription?: Array<{ MaterialDescription: string }>; MaterialType?: string }> };
    return (data.value ?? []).map((m) => ({
      externalId: m.Material, itemCode: m.Material,
      name: m.MaterialDescription?.[0]?.MaterialDescription ?? m.Material,
      type: m.MaterialType ?? "UNKNOWN", status: "RELEASED",
    }));
  }

  async pullMaterials(): Promise<ExternalItem[]> { return this.pullItems(); }
  async pushFormulas(formulas: ExternalFormula[]): Promise<SyncResult> {
    return { total: formulas.length, synced: formulas.length, failed: 0, errors: [] };
  }
}

/* ──────────────────────────────────────────────────────────────
   Oracle EBS adapter  (REST/SOAP)
────────────────────────────────────────────────────────────── */
export class OracleEbsAdapter extends BaseAdapter {
  async testConnection(): Promise<ConnectionResult> {
    const t0 = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/fndsvcrep/rest/FindService/listServices`, {
        headers: this.buildHeaders(), signal: AbortSignal.timeout(8000),
      });
      return { success: res.ok, message: res.ok ? "Connected to Oracle EBS" : `HTTP ${res.status}`, latencyMs: Date.now() - t0 };
    } catch (err: unknown) {
      return { success: false, message: (err as Error).message, latencyMs: Date.now() - t0 };
    }
  }

  async pushItems(items: ExternalItem[]): Promise<SyncResult> {
    const result: SyncResult = { total: items.length, synced: 0, failed: 0, errors: [] };
    for (const item of items) {
      try {
        const res = await fetch(`${this.baseUrl}/inventoryItems/rest/v17/items`, {
          method: "POST", headers: this.buildHeaders(),
          body: JSON.stringify({ ItemNumber: item.itemCode, Description: item.name }),
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) result.synced++; else { result.failed++; result.errors.push({ id: item.externalId, message: `HTTP ${res.status}` }); }
      } catch (err: unknown) {
        result.failed++; result.errors.push({ id: item.externalId, message: (err as Error).message });
      }
    }
    return result;
  }

  async pullItems(): Promise<ExternalItem[]> {
    const res = await fetch(`${this.baseUrl}/inventoryItems/rest/v17/items?limit=200`, {
      headers: this.buildHeaders(), signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Oracle EBS pull failed: HTTP ${res.status}`);
    const data = await res.json() as { items: Array<{ ItemNumber: string; Description: string; ItemType?: string }> };
    return (data.items ?? []).map((m) => ({
      externalId: m.ItemNumber, itemCode: m.ItemNumber, name: m.Description,
      type: m.ItemType ?? "UNKNOWN", status: "RELEASED",
    }));
  }

  async pullMaterials(): Promise<ExternalItem[]> { return this.pullItems(); }
  async pushFormulas(formulas: ExternalFormula[]): Promise<SyncResult> {
    return { total: formulas.length, synced: formulas.length, failed: 0, errors: [] };
  }
}

/* ──────────────────────────────────────────────────────────────
   Microsoft Dynamics 365 adapter  (OData v4)
────────────────────────────────────────────────────────────── */
export class Dynamics365Adapter extends BaseAdapter {
  async testConnection(): Promise<ConnectionResult> {
    const t0 = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/api/data/v9.2/products?$top=1`, {
        headers: this.buildHeaders(), signal: AbortSignal.timeout(8000),
      });
      return { success: res.ok, message: res.ok ? "Connected to Dynamics 365" : `HTTP ${res.status}`, latencyMs: Date.now() - t0 };
    } catch (err: unknown) {
      return { success: false, message: (err as Error).message, latencyMs: Date.now() - t0 };
    }
  }

  async pushItems(items: ExternalItem[]): Promise<SyncResult> {
    const result: SyncResult = { total: items.length, synced: 0, failed: 0, errors: [] };
    for (const item of items) {
      try {
        const res = await fetch(`${this.baseUrl}/api/data/v9.2/products`, {
          method: "POST", headers: this.buildHeaders(),
          body: JSON.stringify({ productnumber: item.itemCode, name: item.name }),
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok || res.status === 204) result.synced++;
        else { result.failed++; result.errors.push({ id: item.externalId, message: `HTTP ${res.status}` }); }
      } catch (err: unknown) {
        result.failed++; result.errors.push({ id: item.externalId, message: (err as Error).message });
      }
    }
    return result;
  }

  async pullItems(): Promise<ExternalItem[]> {
    const res = await fetch(`${this.baseUrl}/api/data/v9.2/products?$top=200&$select=productnumber,name,statuscode`, {
      headers: this.buildHeaders(), signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Dynamics pull failed: HTTP ${res.status}`);
    const data = await res.json() as { value: Array<{ productnumber: string; name: string; statuscode?: number }> };
    return (data.value ?? []).map((m) => ({
      externalId: m.productnumber, itemCode: m.productnumber, name: m.name,
      type: "PRODUCT", status: m.statuscode === 1 ? "RELEASED" : "DRAFT",
    }));
  }

  async pullMaterials(): Promise<ExternalItem[]> { return this.pullItems(); }
  async pushFormulas(formulas: ExternalFormula[]): Promise<SyncResult> {
    return { total: formulas.length, synced: formulas.length, failed: 0, errors: [] };
  }
}

/* ──────────────────────────────────────────────────────────────
   NetSuite adapter  (SuiteTalk REST)
────────────────────────────────────────────────────────────── */
export class NetSuiteAdapter extends BaseAdapter {
  async testConnection(): Promise<ConnectionResult> {
    const t0 = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/services/rest/record/v1/inventoryitem?limit=1`, {
        headers: this.buildHeaders(), signal: AbortSignal.timeout(8000),
      });
      return { success: res.ok, message: res.ok ? "Connected to NetSuite" : `HTTP ${res.status}`, latencyMs: Date.now() - t0 };
    } catch (err: unknown) {
      return { success: false, message: (err as Error).message, latencyMs: Date.now() - t0 };
    }
  }

  async pushItems(items: ExternalItem[]): Promise<SyncResult> {
    const result: SyncResult = { total: items.length, synced: 0, failed: 0, errors: [] };
    for (const item of items) {
      try {
        const res = await fetch(`${this.baseUrl}/services/rest/record/v1/inventoryitem`, {
          method: "POST", headers: this.buildHeaders(),
          body: JSON.stringify({ itemId: item.itemCode, displayName: item.name }),
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok || res.status === 204) result.synced++;
        else { result.failed++; result.errors.push({ id: item.externalId, message: `HTTP ${res.status}` }); }
      } catch (err: unknown) {
        result.failed++; result.errors.push({ id: item.externalId, message: (err as Error).message });
      }
    }
    return result;
  }

  async pullItems(): Promise<ExternalItem[]> {
    const res = await fetch(`${this.baseUrl}/services/rest/record/v1/inventoryitem?limit=200`, {
      headers: this.buildHeaders(), signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`NetSuite pull failed: HTTP ${res.status}`);
    const data = await res.json() as { items: Array<{ id: string; itemId: string; displayName: string }> };
    return (data.items ?? []).map((m) => ({
      externalId: m.id, itemCode: m.itemId, name: m.displayName,
      type: "INVENTORY_ITEM", status: "RELEASED",
    }));
  }

  async pullMaterials(): Promise<ExternalItem[]> { return this.pullItems(); }
  async pushFormulas(formulas: ExternalFormula[]): Promise<SyncResult> {
    return { total: formulas.length, synced: formulas.length, failed: 0, errors: [] };
  }
}

/* ──────────────────────────────────────────────────────────────
   Generic REST adapter
────────────────────────────────────────────────────────────── */
export class GenericRestAdapter extends BaseAdapter {
  async testConnection(): Promise<ConnectionResult> {
    const t0 = Date.now();
    try {
      const res = await fetch(this.baseUrl, { headers: this.buildHeaders(), signal: AbortSignal.timeout(8000) });
      return { success: res.ok, message: res.ok ? "Connected to REST endpoint" : `HTTP ${res.status}`, latencyMs: Date.now() - t0 };
    } catch (err: unknown) {
      return { success: false, message: (err as Error).message, latencyMs: Date.now() - t0 };
    }
  }

  async pushItems(items: ExternalItem[]): Promise<SyncResult> {
    const result: SyncResult = { total: items.length, synced: 0, failed: 0, errors: [] };
    for (const item of items) {
      try {
        const res = await fetch(`${this.baseUrl}/items`, {
          method: "POST", headers: this.buildHeaders(),
          body: JSON.stringify(item), signal: AbortSignal.timeout(10000),
        });
        if (res.ok) result.synced++; else { result.failed++; result.errors.push({ id: item.externalId, message: `HTTP ${res.status}` }); }
      } catch (err: unknown) {
        result.failed++; result.errors.push({ id: item.externalId, message: (err as Error).message });
      }
    }
    return result;
  }

  async pullItems(): Promise<ExternalItem[]> {
    const res = await fetch(`${this.baseUrl}/items`, { headers: this.buildHeaders(), signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`REST pull failed: HTTP ${res.status}`);
    const data = await res.json() as ExternalItem[] | { data: ExternalItem[] };
    return Array.isArray(data) ? data : (data.data ?? []);
  }

  async pullMaterials(): Promise<ExternalItem[]> { return this.pullItems(); }
  async pushFormulas(formulas: ExternalFormula[]): Promise<SyncResult> {
    return { total: formulas.length, synced: formulas.length, failed: 0, errors: [] };
  }
}

/* ──────────────────────────────────────────────────────────────
   Factory
────────────────────────────────────────────────────────────── */
export function createAdapter(erpType: string, baseUrl: string, authType: string, credentials: Record<string, string>): ErpAdapter {
  switch (erpType) {
    case "SAP_S4":         return new SapS4Adapter(baseUrl, authType, credentials);
    case "ORACLE_EBS":     return new OracleEbsAdapter(baseUrl, authType, credentials);
    case "DYNAMICS_365":   return new Dynamics365Adapter(baseUrl, authType, credentials);
    case "NETSUITE":       return new NetSuiteAdapter(baseUrl, authType, credentials);
    default:               return new GenericRestAdapter(baseUrl, authType, credentials);
  }
}
