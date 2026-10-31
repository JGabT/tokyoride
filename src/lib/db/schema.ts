import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const now = () => Date.now();

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

export const tours = sqliteTable(
  "tours",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    body: text("body").notNull().default(""),
    durationHours: integer("duration_hours").notNull().default(4),
    meetingLabel: text("meeting_label").notNull().default(""),
    heroImage: text("hero_image"),
    status: text("status").notNull().default("active"),
    featured: integer("featured").notNull().default(0),
    sort: integer("sort").notNull().default(0),
    /** self = guest drives, staff = our driver is included */
    driverMode: text("driver_mode").notNull().default("self"),
    /** collect pickup and drop-off addresses at checkout (transfers) */
    pickupDropoff: integer("pickup_dropoff").notNull().default(0),
    createdAt: integer("created_at").notNull().$defaultFn(now),
    updatedAt: integer("updated_at").notNull().$defaultFn(now),
  },
  (t) => [index("tours_status_idx").on(t.status, t.sort)],
);

export const vehicles = sqliteTable(
  "vehicles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    chassisCode: text("chassis_code").notNull().default(""),
    kind: text("kind").notNull().default("car"), // car | van
    seats: integer("seats").notNull().default(2),
    luggage: text("luggage").notNull().default(""),
    transmission: text("transmission").notNull().default("Manual"),
    engineCode: text("engine_code").notNull().default(""),
    drivetrain: text("drivetrain").notNull().default(""),
    photo: text("photo"),
    blurb: text("blurb").notNull().default(""),
    specs: text("specs").notNull().default("[]"), // JSON string[]
    active: integer("active").notNull().default(1),
    sort: integer("sort").notNull().default(0),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("vehicles_active_idx").on(t.active, t.sort)],
);

export const tourRates = sqliteTable(
  "tour_rates",
  {
    id: text("id").primaryKey(),
    tourId: text("tour_id").notNull(),
    vehicleId: text("vehicle_id").notNull(),
    priceJpy: integer("price_jpy").notNull().default(0),
    active: integer("active").notNull().default(1),
    updatedAt: integer("updated_at").notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex("tour_rates_unique").on(t.tourId, t.vehicleId)],
);

export const departures = sqliteTable(
  "departures",
  {
    id: text("id").primaryKey(),
    tourId: text("tour_id").notNull(),
    startsAt: integer("starts_at").notNull(),
    endsAt: integer("ends_at").notNull(),
    capacity: integer("capacity").notNull().default(4),
    status: text("status").notNull().default("open"), // open | closed
    note: text("note").notNull().default(""),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [
    uniqueIndex("departures_unique").on(t.tourId, t.startsAt),
    index("departures_window_idx").on(t.startsAt),
  ],
);

/* ------------------------------------------------------------------ */
/* Resource locking (vehicles + drivers)                               */
/* ------------------------------------------------------------------ */

export const resourceBlocks = sqliteTable(
  "resource_blocks",
  {
    id: text("id").primaryKey(),
    resourceType: text("resource_type").notNull(), // vehicle | driver
    resourceId: text("resource_id").notNull(),
    startsAt: integer("starts_at").notNull(),
    endsAt: integer("ends_at").notNull(),
    kind: text("kind").notNull().default("booking"), // booking | maintenance | manual
    bookingId: text("booking_id"),
    note: text("note").notNull().default(""),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [
    index("blocks_resource_idx").on(t.resourceType, t.resourceId, t.startsAt),
    index("blocks_booking_idx").on(t.bookingId),
  ],
);

/* ------------------------------------------------------------------ */
/* Customers + orders                                                  */
/* ------------------------------------------------------------------ */

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  country: text("country").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at").notNull().$defaultFn(now),
});

export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    ref: text("ref").notNull(),
    accessToken: text("access_token").notNull(),
    customerId: text("customer_id").notNull(),
    departureId: text("departure_id").notNull(),
    status: text("status").notNull().default("pending"),
    // pending | paid | confirmed | cancelled | refunded | expired
    totalJpy: integer("total_jpy").notNull().default(0),
    currency: text("currency").notNull().default("JPY"),
    holdExpiresAt: integer("hold_expires_at"),
    paidAt: integer("paid_at"),
    cancelledAt: integer("cancelled_at"),
    notes: text("notes").notNull().default(""),
    pickup: text("pickup"),
    dropoff: text("dropoff"),
    source: text("source").notNull().default("web"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
    updatedAt: integer("updated_at").notNull().$defaultFn(now),
  },
  (t) => [
    uniqueIndex("bookings_ref_unique").on(t.ref),
    index("bookings_status_idx").on(t.status, t.createdAt),
  ],
);

export const bookingVehicles = sqliteTable(
  "booking_vehicles",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id").notNull(),
    vehicleId: text("vehicle_id").notNull(),
    rateId: text("rate_id").notNull(),
    priceJpy: integer("price_jpy").notNull().default(0),
    driverName: text("driver_name").notNull().default(""),
    driverCountry: text("driver_country").notNull().default(""),
    driverLicense: text("driver_license").notNull().default(""),
    driverIdp: text("driver_idp").notNull().default(""),
    driverDob: text("driver_dob").notNull().default(""),
  },
  (t) => [index("booking_vehicles_booking_idx").on(t.bookingId)],
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id").notNull(),
    provider: text("provider").notNull().default("airpay"),
    providerCheckoutId: text("provider_checkout_id").notNull().default(""),
    providerTxnId: text("provider_txn_id").notNull().default(""),
    amountJpy: integer("amount_jpy").notNull().default(0),
    status: text("status").notNull().default("created"),
    // created | pending | paid | failed | expired | refunded
    payload: text("payload").notNull().default("{}"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
    updatedAt: integer("updated_at").notNull().$defaultFn(now),
  },
  (t) => [index("payments_booking_idx").on(t.bookingId)],
);

export const webhookEvents = sqliteTable(
  "webhook_events",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull().default("airpay"),
    eventId: text("event_id").notNull(),
    type: text("type").notNull().default(""),
    payload: text("payload").notNull().default("{}"),
    processedAt: integer("processed_at"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex("webhook_unique").on(t.provider, t.eventId)],
);

export const receipts = sqliteTable(
  "receipts",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id").notNull(),
    number: text("number").notNull(),
    token: text("token").notNull(),
    issuedAt: integer("issued_at").notNull().$defaultFn(now),
    snapshot: text("snapshot").notNull().default("{}"),
  },
  (t) => [
    uniqueIndex("receipts_number_unique").on(t.number),
    uniqueIndex("receipts_token_unique").on(t.token),
  ],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id"),
    kind: text("kind").notNull(),
    channel: text("channel").notNull().default("email"),
    recipient: text("recipient").notNull().default(""),
    subject: text("subject").notNull().default(""),
    body: text("body").notNull().default(""),
    status: text("status").notNull().default("queued"), // queued | sent | failed
    error: text("error").notNull().default(""),
    sentAt: integer("sent_at"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("notifications_status_idx").on(t.status, t.createdAt)],
);

export const inquiries = sqliteTable("inquiries", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  topic: text("topic").notNull().default("general"),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"),
  createdAt: integer("created_at").notNull().$defaultFn(now),
});

/* ------------------------------------------------------------------ */
/* CMS                                                                */
/* ------------------------------------------------------------------ */

export const mapFeatures = sqliteTable(
  "map_features",
  {
    id: text("id").primaryKey(),
    ownerType: text("owner_type").notNull().default("tour"), // tour | site
    ownerId: text("owner_id").notNull().default(""),
    kind: text("kind").notNull().default("start"), // start | end | waypoint | poi
    label: text("label").notNull().default(""),
    lat: text("lat").notNull(),
    lng: text("lng").notNull(),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("map_owner_idx").on(t.ownerType, t.ownerId, t.sort)],
);

export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: integer("updated_at").notNull().$defaultFn(now),
});

export const media = sqliteTable("media", {
  id: text("id").primaryKey(),
  key: text("key").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull().default(""),
  size: integer("size").notNull().default(0),
  createdAt: integer("created_at").notNull().$defaultFn(now),
});

/* ------------------------------------------------------------------ */
/* Auth                                                               */
/* ------------------------------------------------------------------ */

export const adminUsers = sqliteTable(
  "admin_users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull().default("Admin"),
    passwordHash: text("password_hash").notNull(),
    salt: text("salt").notNull(),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex("admin_email_unique").on(t.email)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export type Tour = typeof tours.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type TourRate = typeof tourRates.$inferSelect;
export type Departure = typeof departures.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type BookingVehicle = typeof bookingVehicles.$inferSelect;
export type MapFeature = typeof mapFeatures.$inferSelect;
export type AdminUser = typeof adminUsers.$inferSelect;
