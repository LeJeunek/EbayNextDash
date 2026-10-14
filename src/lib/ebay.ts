// src/lib/ebay.ts
import { XMLParser } from "fast-xml-parser";

const EBAY_API_BASE =
  process.env.EBAY_API_BASE || "https://api.sandbox.ebay.com";

// ─── Trading API ─────────────────────────────────────────────────────────────
// The Inventory API only returns listings created through the Inventory API.
// Listings made on eBay.com or in Seller Hub never appear there, so syncing
// through it silently found nothing. The Trading API's GetMyeBaySelling
// returns every active listing however it was created. It accepts the same
// OAuth user token, sent as X-EBAY-API-IAF-TOKEN.
const TRADING_API_URL = `${EBAY_API_BASE}/ws/api.dll`;
const TRADING_COMPATIBILITY_LEVEL = "1349";
const TRADING_PAGE_SIZE = 200; // GetMyeBaySelling maximum
const TRADING_MAX_PAGES = 50;

const tradingXml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  // Repeated elements parse as an array only when there are two or more;
  // force the ones we iterate so a single listing or error still loops.
  isArray: (name) => name === "Item" || name === "Errors",
});

/** An active eBay listing, normalised from the Trading API. */
export type ActiveListing = {
  itemId: string;
  title: string;
  price: number;
  currency: string;
  quantity: number;
  quantitySold: number;
  imageUrl: string | null;
  listingUrl: string | null;
  startTime: Date | null;
  endTime: Date | null;
};

function tradingAmount(value: any): { amount: number; currency: string | null } {
  if (value === undefined || value === null) return { amount: 0, currency: null };
  if (typeof value === "object") {
    return {
      amount: parseFloat(value["#text"]) || 0,
      currency: value["@_currencyID"] ?? null,
    };
  }
  return { amount: parseFloat(value) || 0, currency: null };
}

function tradingDate(value: any): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function mapTradingItem(item: any): ActiveListing {
  const price = tradingAmount(
    item.SellingStatus?.CurrentPrice ?? item.BuyItNowPrice ?? item.StartPrice
  );
  return {
    itemId: String(item.ItemID),
    title: String(item.Title ?? item.ItemID),
    price: price.amount,
    currency: price.currency || "USD",
    quantity: Number(item.QuantityAvailable ?? item.Quantity ?? 0) || 0,
    quantitySold: Number(item.SellingStatus?.QuantitySold ?? 0) || 0,
    imageUrl: item.PictureDetails?.GalleryURL ?? null,
    listingUrl: item.ListingDetails?.ViewItemURL ?? null,
    startTime: tradingDate(item.ListingDetails?.StartTime),
    endTime: tradingDate(item.ListingDetails?.EndTime),
  };
}

export class EbayApiClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${EBAY_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        // Node's fetch sends "Accept-Language: *" when none is set, and the
        // Inventory API rejects the wildcard (errorId 25709, "Invalid value
        // for header Accept-Language"). eBay also requires Content-Language
        // when creating or replacing inventory items. Both match EBAY_US.
        "Accept-Language": "en-US",
        "Content-Language": "en-US",
        ...(options?.headers || {}),
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(
        `eBay API error ${res.status}: ${JSON.stringify(error)}`
      );
    }

    return res.json();
  }

  // ─── Trading API ─────────────────────────────────────────────────────────

  private async trading(callName: string, innerXml: string): Promise<any> {
    const res = await fetch(TRADING_API_URL, {
      method: "POST",
      headers: {
        "X-EBAY-API-CALL-NAME": callName,
        "X-EBAY-API-SITEID": "0", // eBay US
        "X-EBAY-API-COMPATIBILITY-LEVEL": TRADING_COMPATIBILITY_LEVEL,
        "X-EBAY-API-IAF-TOKEN": this.accessToken,
        "Content-Type": "text/xml",
        "Accept-Language": "en-US",
      },
      body:
        `<?xml version="1.0" encoding="utf-8"?>` +
        `<${callName}Request xmlns="urn:ebay:apis:eBLBaseComponents">${innerXml}</${callName}Request>`,
    });

    const text = await res.text();
    let doc: any;
    try {
      doc = text ? tradingXml.parse(text)?.[`${callName}Response`] : undefined;
    } catch {
      doc = undefined;
    }

    // Ack is Success, Warning, Failure or PartialFailure; the first two are fine.
    if (!res.ok || !doc || doc.Ack === "Failure" || doc.Ack === "PartialFailure") {
      const details = (doc?.Errors ?? [])
        .map((e: any) => `${e.ErrorCode}: ${e.LongMessage || e.ShortMessage}`)
        .join("; ");
      throw new Error(
        `eBay Trading API ${callName} failed (${res.status})` +
          (details ? `: ${details}` : text ? ": unreadable response" : ": empty response")
      );
    }
    return doc;
  }

  /** Every active listing on the account, however it was created. */
  async getActiveListings(): Promise<ActiveListing[]> {
    const listings: ActiveListing[] = [];
    for (let page = 1; page <= TRADING_MAX_PAGES; page++) {
      const doc = await this.trading(
        "GetMyeBaySelling",
        `<ActiveList><Include>true</Include>` +
          `<Pagination><EntriesPerPage>${TRADING_PAGE_SIZE}</EntriesPerPage>` +
          `<PageNumber>${page}</PageNumber></Pagination></ActiveList>` +
          `<DetailLevel>ReturnAll</DetailLevel>`
      );
      // eBay omits ActiveList entirely when there are no active listings.
      const active = doc.ActiveList;
      for (const item of active?.ItemArray?.Item ?? []) {
        listings.push(mapTradingItem(item));
      }
      const totalPages = Number(active?.PaginationResult?.TotalNumberOfPages) || 1;
      if (page >= totalPages) return listings;
    }
    // Returning a partial list would mark the unseen listings as ended.
    throw new Error(
      `More than ${TRADING_MAX_PAGES * TRADING_PAGE_SIZE} active listings; sync stopped rather than save a partial result.`
    );
  }

  // ─── Inventory ───────────────────────────────────────────────────────────

  async getListings(limit = 50, offset = 0) {
    return this.fetch<any>(
      `/sell/inventory/v1/inventory_item?limit=${limit}&offset=${offset}`
    );
  }

  async getListing(sku: string) {
    return this.fetch<any>(`/sell/inventory/v1/inventory_item/${sku}`);
  }

  async createOrUpdateListing(sku: string, data: CreateListingPayload) {
    return this.fetch<any>(`/sell/inventory/v1/inventory_item/${sku}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteListing(sku: string) {
    return this.fetch<any>(`/sell/inventory/v1/inventory_item/${sku}`, {
      method: "DELETE",
    });
  }

  // ─── Orders ──────────────────────────────────────────────────────────────

  async getOrders(filter?: string, limit = 50, offset = 0) {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (filter) params.set("filter", filter);
    return this.fetch<any>(`/sell/fulfillment/v1/order?${params}`);
  }

  async getOrder(orderId: string) {
    return this.fetch<any>(`/sell/fulfillment/v1/order/${orderId}`);
  }

  async getRecentOrders(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const filter = `lastmodifieddate:[${since.toISOString()}..]`;
    return this.getOrders(filter, 200);
  }

  // ─── Seller Summary ───────────────────────────────────────────────────────

  async getSellerSummary() {
    return this.fetch<any>(`/sell/account/v1/privilege`);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateListingPayload {
  availability: {
    shipToLocationAvailability: {
      quantity: number;
    };
  };
  condition: string;
  product: {
    title: string;
    description: string;
    imageUrls?: string[];
    aspects?: Record<string, string[]>;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Map eBay order data → our DB shape */
export function mapEbayOrder(ebayOrder: any, userId: string) {
  const lineItem = ebayOrder.lineItems?.[0];
  const salePrice = parseFloat(
    ebayOrder.pricingSummary?.total?.value || "0"
  );
  const shippingCost = parseFloat(
    ebayOrder.pricingSummary?.deliveryCost?.value || "0"
  );
  const ebayFee = parseFloat(
    ebayOrder.totalMarketplaceFee?.value || "0"
  );

  return {
    orderId: ebayOrder.orderId,
    userId,
    itemTitle: lineItem?.title || "Unknown Item",
    buyerUsername: ebayOrder.buyer?.username || null,
    buyerEmail: ebayOrder.buyer?.taxAddress?.email || null,
    salePrice,
    shippingCost,
    ebayFee,
    profit: salePrice - shippingCost - ebayFee,
    currency: ebayOrder.pricingSummary?.total?.currency || "USD",
    status: mapOrderStatus(ebayOrder.orderFulfillmentStatus),
    paymentStatus: ebayOrder.orderPaymentStatus,
    shippingStatus: ebayOrder.orderFulfillmentStatus,
    saleDate: new Date(ebayOrder.creationDate),
    paidDate: ebayOrder.paymentSummary?.payments?.[0]?.paymentDate
      ? new Date(ebayOrder.paymentSummary.payments[0].paymentDate)
      : null,
  };
}

function mapOrderStatus(fulfillmentStatus: string) {
  const map: Record<string, any> = {
    NOT_STARTED: "PAID",
    IN_PROGRESS: "SHIPPED",
    FULFILLED: "DELIVERED",
    UNFULFILLABLE: "CANCELLED",
  };
  return map[fulfillmentStatus] || "PENDING";
}
