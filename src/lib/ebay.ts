// src/lib/ebay.ts
const EBAY_API_BASE =
  process.env.EBAY_API_BASE || "https://api.sandbox.ebay.com";

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
    const filter = `lastmodifieddate:[${since.toISOString()}..]}`;
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
