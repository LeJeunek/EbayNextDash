// src/lib/demo/fixtures.ts
//
// The sample store every demo screen is drawn from. Pure and deterministic:
// the same `now` always yields the same data, and nothing here reads the
// database or calls eBay. Dates are offsets from `now`, so "last 30 days"
// views always have something in them whenever the demo is opened.
//
// Rows are typed as the real Prisma models, so a schema change that the demo
// doesn't account for fails to compile rather than rendering half-empty pages.
import type { InventoryItem, Listing, Order } from "@prisma/client";

export const DEMO_USER = {
  id: "demo-user",
  name: "Demo Seller",
  // .example is reserved by RFC 2606, so this can never be a real address.
  email: "demo_seller@resold.example",
  image: null as string | null,
  ebayUsername: "demo_seller",
  ebayUserId: "demo",
};

export type DemoData = {
  listings: Listing[];
  orders: Order[];
  inventory: InventoryItem[];
};

const DAY = 24 * 60 * 60 * 1000;

// [title, category, source, cost, sale, packing, shipping, fees, days since sale, days held before sale]
const SOLD: [string, string, string, number, number, number, number, number, number, number][] = [
  ["Griswold No. 8 Cast Iron Skillet", "Kitchen", "Garage sale", 20, 95, 4, 17.6, 12.35, 7, 97],
  ["Sony Walkman WM-F2015", "Electronics", "Estate sale", 15, 72.5, 3, 9.4, 9.43, 20, 119],
  ["Pokémon Base Set Charizard (Played)", "Collectibles", "Attic", 0, 210, 1.5, 5.2, 27.3, 52, 123],
  ["LEGO Technic 42083 Bugatti Chiron – Complete", "Toys", "Facebook Marketplace", 150, 329, 8, 32.5, 42.77, 98, 104],
  ["Levi's 501 Vintage Jeans 32x30", "Clothing", "Thrift store", 8, 54, 2, 7.95, 7.02, 120, 78],
  ["Pyrex Butterprint Mixing Bowls (set of 4)", "Kitchen", "Thrift store", 12, 68, 6.25, 16.8, 8.84, 170, 66],
  ["Canon AE-1 Program 35mm Film Camera", "Cameras", "Estate sale", 40, 185, 5, 14.2, 24.05, 205, 53],
  ["Nintendo GameCube – Indigo, 2 controllers", "Consoles", "Garage sale", 35, 119.99, 4.5, 18.4, 15.6, 245, 23],
];

// [title, category, source, cost, days since purchase, asking price]
const LISTED: [string, string, string, number, number, number][] = [
  ["Polaroid SX-70 Land Camera", "Cameras", "Estate sale", 55, 30, 149.99],
  ["Vintage Denim Trucker Jacket – M", "Clothing", "Thrift store", 18, 55, 45],
  ["Hot Wheels Redlines (lot of 12)", "Toys", "Garage sale", 30, 90, 89],
];

// Extra active listings that aren't in the ledger, plus two that ended.
const OTHER_LISTINGS: [string, number, "ACTIVE" | "ENDED"][] = [
  ["Atari 2600 Console – Tested", 120, "ACTIVE"],
  ["Corningware Blue Cornflower Casserole", 32.5, "ACTIVE"],
  ["Coleman 200A Lantern (1974)", 58, "ENDED"],
  ["Beatles – Abbey Road LP", 41.5, "ENDED"],
];

// [item, sale, shipping, fees, days ago, status]
const ORDERS: [string, number, number, number, number, Order["status"]][] = [
  ["Beatles – Abbey Road LP", 41.5, 5.6, 5.4, 1, "PAID"],
  ["Tamagotchi Original (1997)", 64, 4.95, 8.32, 3, "PAID"],
  ["Griswold No. 8 Cast Iron Skillet", 95, 17.6, 12.35, 6, "SHIPPED"],
  ["Nike Air Max 90 – Size 10", 88, 12.4, 11.44, 9, "SHIPPED"],
  ["Vintage Pyrex Refrigerator Dish", 29.99, 8.2, 3.9, 12, "DELIVERED"],
  ["Star Wars Kenner Figure Lot", 47, 6.1, 6.11, 15, "CANCELLED"],
  ["Sony Walkman WM-F2015", 72.5, 9.4, 9.43, 19, "DELIVERED"],
  ["Atari 2600 Joystick Pair", 38, 6.8, 4.94, 23, "DELIVERED"],
  ["Coleman 200A Lantern (1974)", 58, 15.3, 7.54, 27, "DELIVERED"],
  ["Pokémon Base Set Charizard (Played)", 210, 5.2, 27.3, 52, "DELIVERED"],
  ["Fire-King Jadeite Mug", 24, 7.4, 3.12, 64, "DELIVERED"],
  ["LEGO Technic 42083 Bugatti Chiron", 329, 32.5, 42.77, 98, "DELIVERED"],
  ["Levi's 501 Vintage Jeans 32x30", 54, 7.95, 7.02, 120, "DELIVERED"],
];

const round2 = (n: number) => Math.round(n * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");

export function buildDemoData(now: Date): DemoData {
  const ago = (days: number) => new Date(now.getTime() - days * DAY);
  const userId = DEMO_USER.id;

  const inventory: InventoryItem[] = [
    ...SOLD.map(([title, category, source, cost, sale, packing, shipping, fees, soldAgo, held], i): InventoryItem => ({
      id: `demo-inv-${pad(i + 1)}`,
      userId,
      title,
      sku: `DEMO-${pad(i + 1)}`,
      category,
      condition: null,
      notes: null,
      purchaseDate: ago(soldAgo + held),
      source,
      originalCost: cost,
      sellPrice: sale,
      packingCost: packing,
      shippingCost: shipping,
      ebayFee: fees,
      otherCost: 0,
      status: "SOLD",
      listedDate: ago(soldAgo + Math.round(held / 2)),
      soldDate: ago(soldAgo),
      ebayListingId: null,
      ebayOrderId: null,
      createdAt: ago(soldAgo + held),
      updatedAt: ago(soldAgo),
    })),
    ...LISTED.map(([title, category, source, cost, boughtAgo], i): InventoryItem => ({
      id: `demo-inv-${pad(SOLD.length + i + 1)}`,
      userId,
      title,
      sku: `DEMO-${pad(SOLD.length + i + 1)}`,
      category,
      condition: null,
      notes: null,
      purchaseDate: ago(boughtAgo),
      source,
      originalCost: cost,
      sellPrice: null,
      packingCost: 0,
      shippingCost: 0,
      ebayFee: 0,
      otherCost: 0,
      status: "LISTED",
      listedDate: ago(boughtAgo - 5),
      soldDate: null,
      ebayListingId: null,
      ebayOrderId: null,
      createdAt: ago(boughtAgo),
      updatedAt: ago(boughtAgo - 5),
    })),
  ];

  const listingRows: [string, number, "ACTIVE" | "ENDED", number][] = [
    ...LISTED.map(([title, , , , boughtAgo, price]): [string, number, "ACTIVE", number] => [title, price, "ACTIVE", boughtAgo - 5]),
    ...OTHER_LISTINGS.map(([title, price, status], i): [string, number, "ACTIVE" | "ENDED", number] => [title, price, status, 14 + i * 9]),
  ];
  const listings: Listing[] = listingRows.map(([title, price, status, listedAgo], i) => ({
    id: `demo-lst-${pad(i + 1)}`,
    // Clearly fake IDs, and no listing URL: real-looking item numbers could
    // send demo visitors to some stranger's listing on eBay.
    ebayListingId: `DEMO-${1001 + i}`,
    userId,
    title,
    description: null,
    price,
    currency: "USD",
    quantity: status === "ACTIVE" ? 1 : 0,
    quantitySold: status === "ENDED" ? 1 : 0,
    status,
    category: null,
    imageUrl: null,
    listingUrl: null,
    startTime: ago(listedAgo),
    endTime: null,
    condition: null,
    shippingCost: null,
    ebayFee: null,
    createdAt: ago(listedAgo),
    updatedAt: ago(Math.max(listedAgo - 2, 0)),
  }));

  const orders: Order[] = ORDERS.map(([itemTitle, salePrice, shippingCost, ebayFee, daysAgo, status], i) => ({
    id: `demo-ord-${pad(i + 1)}`,
    orderId: `DEMO-${pad(i + 1)}-${(4800 + i * 37).toString().padStart(5, "0")}`,
    userId,
    listingId: null,
    buyerUsername: `demo_buyer_${pad(i + 1)}`,
    buyerEmail: null,
    itemTitle,
    salePrice,
    shippingCost,
    ebayFee,
    profit: round2(salePrice - shippingCost - ebayFee),
    currency: "USD",
    status,
    paymentStatus: status === "CANCELLED" ? "REFUNDED" : "PAID",
    shippingStatus: status === "PAID" ? "NOT_STARTED" : status === "CANCELLED" ? null : "FULFILLED",
    trackingNumber: null,
    carrier: null,
    saleDate: ago(daysAgo),
    paidDate: status === "CANCELLED" ? null : ago(daysAgo),
    shippedDate: status === "SHIPPED" || status === "DELIVERED" ? ago(Math.max(daysAgo - 1, 0)) : null,
    createdAt: ago(daysAgo),
    updatedAt: ago(Math.max(daysAgo - 1, 0)),
  }));

  return { listings, orders, inventory };
}
