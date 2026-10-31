import { eq } from "drizzle-orm";
import { db } from "./db";
import { siteSettings } from "./db/schema";

export const SETTING_KEYS = [
  "brand_name",
  "tagline",
  "hero_title",
  "hero_kicker",
  "hero_body",
  "hero_image",
  "phone",
  "email",
  "address",
  "lat",
  "lng",
  "hours",
  "instagram",
  "legal_name",
  "legal_address",
  "legal_phone",
  "legal_responsible",
  "travel_registration",
  "cancellation_policy",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];
export type Settings = Record<SettingKey, string>;

const DEFAULTS: Settings = {
  brand_name: "TOKYORIDE",
  tagline: "Self-drive JDM rentals from Fujisawa",
  hero_title: "Drive the cars you grew up on.",
  hero_kicker: "Fujisawa · Kanagawa · Japan",
  hero_body:
    "Four-hour runs out of Fujisawa in an R32, R34, R35 or AE86. Take the wheel yourself, ride with one of our drivers, or book point to point.",
  hero_image: "/hero-kanagawa.jpg",
  phone: "+81 46-258-9614",
  email: "hello@tokyoride.co",
  address: "Fujisawa, Kanagawa, Japan",
  lat: "35.3836",
  lng: "139.4131",
  hours: "Pickups 09:00–20:00 JST",
  instagram: "",
  legal_name: "Tokyoride",
  legal_address: "Fujisawa, Kanagawa, Japan",
  legal_phone: "+81 46-258-9614",
  legal_responsible: "Representative Director",
  travel_registration: "",
  cancellation_policy:
    "Free cancellation up to 72 hours before pickup. 50% within 72 hours. No refund within 24 hours.",
};

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(siteSettings);
  const merged = { ...DEFAULTS };
  for (const row of rows) {
    if (row.key in merged) merged[row.key as SettingKey] = row.value;
  }
  return merged;
}

export async function setSetting(key: string, value: string) {
  const existing = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, key));
  if (existing.length) {
    await db
      .update(siteSettings)
      .set({ value, updatedAt: Date.now() })
      .where(eq(siteSettings.key, key));
  } else {
    await db.insert(siteSettings).values({ key, value });
  }
}
