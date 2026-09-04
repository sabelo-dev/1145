// CJdropshipping adapter (API v2). Credentials come from edge-function secrets
// only — they are never stored in the database or exposed to the frontend.
import type {
  DiscoverParams,
  SupplierAdapter,
  SupplierOrderRequest,
  SupplierOrderResult,
  SupplierOrderStatus,
  SupplierProductDTO,
  SupplierStockDTO,
  SupplierTracking,
  SupplierVariantDTO,
} from "./types.ts";

const BASE = "https://developers.cjdropshipping.com/api2.0/v1";

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

// Module-scoped token cache (CJ rate-limits token creation to once per 5 min).
let tokenCache: TokenCache | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// CJ allows 1 request per second per account. Every outbound call goes through
// this serial queue so concurrent syncs can never trip the QPS limit.
const CJ_MIN_INTERVAL_MS = 1200;
let cjQueue: Promise<unknown> = Promise.resolve();
let cjLastCallAt = 0;

function cjThrottle<T>(fn: () => Promise<T>): Promise<T> {
  const run = cjQueue.then(async () => {
    const wait = CJ_MIN_INTERVAL_MS - (Date.now() - cjLastCallAt);
    if (wait > 0) await sleep(wait);
    try {
      return await fn();
    } finally {
      cjLastCallAt = Date.now();
    }
  });
  cjQueue = run.catch(() => {});
  return run as Promise<T>;
}

type Logger = (entry: {
  endpoint: string;
  method: string;
  status_code?: number;
  duration_ms: number;
  success: boolean;
  error_type?: string;
  error_message?: string;
  context?: Record<string, unknown>;
}) => void;

export class CJAdapter implements SupplierAdapter {
  code = "cjdropshipping";
  private email: string;
  private apiKey: string;
  private log: Logger;

  constructor(email: string, apiKey: string, log: Logger = () => {}) {
    this.email = email;
    this.apiKey = apiKey;
    this.log = log;
  }

  private async token(): Promise<string> {
    if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.accessToken;
    const started = Date.now();
    const res = await cjThrottle(() =>
      fetch(`${BASE}/authentication/getAccessToken`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: this.email, password: this.apiKey }),
      })
    );
    const json = await res.json().catch(() => ({}));
    const ok = res.ok && json?.result === true && json?.data?.accessToken;
    this.log({
      endpoint: "/authentication/getAccessToken",
      method: "POST",
      status_code: res.status,
      duration_ms: Date.now() - started,
      success: !!ok,
      error_type: ok ? undefined : "auth",
      error_message: ok ? undefined : (json?.message || `HTTP ${res.status}`),
    });
    if (!ok) throw new Error(`CJ authentication failed: ${json?.message || res.status}`);
    tokenCache = {
      accessToken: json.data.accessToken,
      // CJ tokens live 15 days; refresh conservatively every 12 hours.
      expiresAt: Date.now() + 12 * 60 * 60 * 1000,
    };
    return tokenCache.accessToken;
  }

  private async call<T>(
    path: string,
    opts: { method?: "GET" | "POST"; query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> {
    const method = opts.method || "GET";
    const url = new URL(`${BASE}${path}`);
    for (const [k, v] of Object.entries(opts.query || {})) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }

    const maxAttempts = 4;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const started = Date.now();
      let status = 0;
      try {
        const accessToken = await this.token();
        // CJ enforces 1 request per second per account — every call is queued.
        const res = await cjThrottle(() =>
          fetch(url.toString(), {
            method,
            headers: {
              "Content-Type": "application/json",
              "CJ-Access-Token": accessToken,
            },
            body: method === "POST" ? JSON.stringify(opts.body ?? {}) : undefined,
          })
        );
        status = res.status;
        const json = await res.json().catch(() => ({}));
        const success = res.ok && json?.result !== false;
        const message = json?.message || `HTTP ${status}`;
        const rateLimited = status === 429 || /too many requests|qps limit|frequen/i.test(String(message));

        if (!success && rateLimited && attempt < maxAttempts) {
          lastError = new Error(message);
          await sleep(attempt * 1500);
          continue;
        }

        this.log({
          endpoint: path,
          method,
          status_code: status,
          duration_ms: Date.now() - started,
          success,
          error_type: success ? undefined : (rateLimited ? "rate_limit" : "api"),
          error_message: success ? undefined : message,
        });
        if (!success) throw new Error(message);
        return json.data as T;
      } catch (err) {
        if (status === 0) {
          if (attempt < maxAttempts) {
            lastError = err instanceof Error ? err : new Error(String(err));
            await sleep(attempt * 1000);
            continue;
          }
          this.log({
            endpoint: path,
            method,
            duration_ms: Date.now() - started,
            success: false,
            error_type: "network",
            error_message: err instanceof Error ? err.message : String(err),
          });
        }
        throw err;
      }
    }

    throw lastError ?? new Error("CJ request failed");
  }

  async health() {
    try {
      await this.token();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  private mapVariant(v: Record<string, any>): SupplierVariantDTO {
    const attrs: Record<string, string> = {};
    const key = v.variantKey || v.variantNameEn || "";
    String(key)
      .split("-")
      .filter(Boolean)
      .forEach((part: string, i: number) => (attrs[`option_${i + 1}`] = part.trim()));
    return {
      supplierVariantId: String(v.vid || v.variantId || ""),
      sku: v.variantSku || undefined,
      name: v.variantNameEn || v.variantKey || undefined,
      attributes: attrs,
      imageUrl: v.variantImage || undefined,
      cost: Number(v.variantSellPrice ?? v.variantPrice ?? 0),
      stock: Number(v.variantQuantity ?? v.variantStock ?? 0),
      weightGrams: v.variantWeight ? Number(v.variantWeight) : undefined,
    };
  }

  private mapProduct(p: Record<string, any>, variants: SupplierVariantDTO[] = []): SupplierProductDTO {
    const images: string[] = Array.isArray(p.productImageSet)
      ? p.productImageSet
      : typeof p.productImage === "string"
      ? [p.productImage]
      : [];
    const cost = Number(
      p.sellPrice ?? (typeof p.productPrice === "string" ? p.productPrice.split("--")[0] : p.productPrice) ?? 0,
    );
    return {
      supplierProductId: String(p.pid || p.productId || ""),
      sku: p.productSku || undefined,
      name: p.productNameEn || p.productName || "Untitled product",
      description: p.description || p.productDescription || undefined,
      images,
      category: p.categoryName || undefined,
      cost: variants.length ? Math.min(...variants.map((v) => v.cost || cost)) : cost,
      currency: "USD",
      shippingCost: 0,
      stock: variants.length
        ? variants.reduce((sum, v) => sum + (v.stock || 0), 0)
        : Number(p.listedNum ?? p.productQuantity ?? 0),
      weightGrams: p.productWeight ? Number(p.productWeight) : undefined,
      warehouse: p.entryName || p.sourceFrom || undefined,
      variants,
      raw: p,
    };
  }

  async discover(params: DiscoverParams) {
    const data = await this.call<any>("/product/list", {
      query: {
        pageNum: params.page || 1,
        pageSize: Math.min(params.pageSize || 20, 50),
        productNameEn: params.query,
        categoryId: params.category,
      },
    });
    const list: any[] = data?.list || [];
    return {
      items: list.map((p) => this.mapProduct(p)),
      total: Number(data?.total ?? list.length),
    };
  }

  async getProduct(supplierProductId: string) {
    const data = await this.call<any>("/product/query", { query: { pid: supplierProductId } });
    const variants: SupplierVariantDTO[] = (data?.variants || []).map((v: any) => this.mapVariant(v));
    return this.mapProduct(data || {}, variants);
  }

  async getStock(supplierVariantIds: string[]) {
    const out: SupplierStockDTO[] = [];
    for (const vid of supplierVariantIds) {
      try {
        const data = await this.call<any>("/product/stock/queryByVid", { query: { vid } });
        const rows: any[] = Array.isArray(data) ? data : data?.list || [];
        const stock = rows.reduce((sum, r) => sum + Number(r.storageNum ?? r.totalInventoryNum ?? 0), 0);
        out.push({ supplierVariantId: vid, stock });
      } catch {
        // A single variant failure must not blank out the whole catalogue.
      }
    }
    return out;
  }

  async createOrder(req: SupplierOrderRequest): Promise<SupplierOrderResult> {
    const data = await this.call<any>("/shopping/order/createOrderV2", {
      method: "POST",
      body: {
        orderNumber: req.externalOrderNumber,
        shippingCountryCode: req.shipping.countryCode || "ZA",
        shippingCountry: req.shipping.country || "South Africa",
        shippingProvince: req.shipping.province || "",
        shippingCity: req.shipping.city,
        shippingAddress: req.shipping.street,
        shippingCustomerName: req.shipping.name,
        shippingZip: req.shipping.postalCode || "",
        shippingPhone: req.shipping.phone || "",
        remark: req.remark || "",
        fromCountryCode: "CN",
        logisticName: req.shippingMethod || undefined,
        products: req.lines.map((l) => ({ vid: l.supplierVariantId, quantity: l.quantity })),
      },
    });
    return {
      supplierOrderNumber: String(data?.orderId || data?.orderNum || req.externalOrderNumber),
      status: String(data?.orderStatus || "CREATED"),
      cost: data?.productAmount ? Number(data.productAmount) : undefined,
      shippingCost: data?.postageAmount ? Number(data.postageAmount) : undefined,
      currency: "USD",
    };
  }

  async findOrderByExternalNumber(externalOrderNumber: string) {
    try {
      const data = await this.call<any>("/shopping/order/list", {
        query: { pageNum: 1, pageSize: 20, orderIds: externalOrderNumber },
      });
      const list: any[] = data?.list || [];
      const hit = list.find(
        (o) => String(o.orderNum) === externalOrderNumber || String(o.cjOrderId) === externalOrderNumber,
      ) || list[0];
      if (!hit) return null;
      return {
        supplierOrderNumber: String(hit.orderId || hit.cjOrderId),
        status: String(hit.orderStatus || ""),
        carrier: hit.logisticName || undefined,
        trackingNumber: hit.trackNumber || undefined,
        cost: hit.productAmount ? Number(hit.productAmount) : undefined,
        shippingCost: hit.postageAmount ? Number(hit.postageAmount) : undefined,
      } as SupplierOrderStatus;
    } catch {
      return null;
    }
  }

  async getOrder(supplierOrderNumber: string) {
    const data = await this.call<any>("/shopping/order/getOrderDetail", {
      query: { orderId: supplierOrderNumber },
    });
    if (!data) return null;
    return {
      supplierOrderNumber,
      status: String(data.orderStatus || ""),
      carrier: data.logisticName || undefined,
      trackingNumber: data.trackNumber || undefined,
      cost: data.productAmount ? Number(data.productAmount) : undefined,
      shippingCost: data.postageAmount ? Number(data.postageAmount) : undefined,
    } as SupplierOrderStatus;
  }

  async getTracking(trackingNumber: string): Promise<SupplierTracking | null> {
    try {
      const data = await this.call<any>("/logistic/trackInfo", { query: { trackNumber: trackingNumber } });
      const rows: any[] = Array.isArray(data) ? data : data?.trackList || [];
      const events = rows.map((e) => ({
        status: String(e.status || e.trackStatus || "update"),
        description: e.content || e.description || undefined,
        location: e.location || e.address || undefined,
        occurredAt: e.date || e.trackDate || new Date().toISOString(),
      }));
      return {
        trackingNumber,
        carrier: data?.logisticName || undefined,
        status: events[0]?.status || "in_transit",
        events,
      };
    } catch {
      return null;
    }
  }

  async verifyWebhook(req: Request, rawBody: string): Promise<boolean> {
    const secret = Deno.env.get("CJ_WEBHOOK_SECRET");
    if (!secret) return false;
    const provided = req.headers.get("cj-signature") || req.headers.get("x-cj-signature") || "";
    if (!provided) return false;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
    // constant-time-ish comparison
    if (hex.length !== provided.length) return false;
    let diff = 0;
    for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ provided.charCodeAt(i);
    return diff === 0;
  }
}
