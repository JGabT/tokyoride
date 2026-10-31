import { db } from "./db";
import {
  adminUsers,
  bookingVehicles,
  bookings,
  customers,
  departures,
  inquiries,
  mapFeatures,
  media,
  notifications,
  payments,
  receipts,
  resourceBlocks,
  siteSettings,
  tourRates,
  tours,
  vehicles,
  webhookEvents,
} from "./db/schema";
import { hashPassword, newSalt } from "./auth";
import { addDays, jstDateKey, jstToUtc } from "./dates";
import { newId } from "./ids";
import { env } from "./runtime";

/**
 * Demo content: three courses (A/B/C), five vehicles, 90 days of departures.
 * Destructive — wipes every table.
 */

const COURSES = [
  {
    id: "course-a",
    title: "Course A — Full Tour with Driver",
    subtitle:
      "Sit back. One of our drivers takes the wheel for a full four-hour run — Wangan, Daikoku PA, or the Hakone touge.",
    durationHours: 4,
    meetingLabel: "Tokyoride base, Fujisawa",
    driverMode: "staff",
    pickupDropoff: 0,
    featured: 1,
    sort: 1,
    times: ["10:00"],
    body: `Course A is the full experience with none of the paperwork. You ride, our driver drives.\n\nWe plan the route with you before setting off — the Wangan to Daikoku PA, the Shonan coast at golden hour, or the Hakone mountain passes — and the car comes back to base when the run is done.\n\nNo licence, no permit, no deposit. Just show up at the Fujisawa base and bring a camera.`,
    points: [
      { kind: "start", label: "Fujisawa base", lat: 35.3836, lng: 139.4131 },
      { kind: "end", label: "Daikoku PA", lat: 35.4529, lng: 139.6685 },
    ],
  },
  {
    id: "course-b",
    title: "Course B — Self Drive",
    subtitle:
      "You take the wheel. Four hours, a briefed route, and the keys to an R32, R34, R35 or AE86.",
    durationHours: 4,
    meetingLabel: "Tokyoride base, Fujisawa",
    driverMode: "self",
    pickupDropoff: 0,
    featured: 1,
    sort: 2,
    times: ["15:00"],
    body: `Course B is the one you came for: the keys are yours.\n\nAfter a walkaround and route briefing you drive the car yourself — coastal Route 134, the Hakone touge, or the Wangan depending on the light and the traffic. We handle fuel, tolls and the ETC card.\n\nYou need a valid home licence and an International Driving Permit under the 1949 Geneva Convention, plus manual gearbox experience. Drivers must be 25 or older.`,
    points: [
      { kind: "start", label: "Fujisawa base", lat: 35.3836, lng: 139.4131 },
      { kind: "waypoint", label: "Hakone", lat: 35.2324, lng: 139.1069 },
      { kind: "end", label: "Fujisawa base", lat: 35.3836, lng: 139.4131 },
    ],
  },
  {
    id: "course-c",
    title: "Course C — Point A to Point B",
    subtitle:
      "A two-hour transfer in the car of your choice. Airport runs, hotel pickups, or a drop anywhere in Kanagawa.",
    durationHours: 2,
    meetingLabel: "Your pickup point",
    driverMode: "staff",
    pickupDropoff: 1,
    featured: 1,
    sort: 3,
    times: ["09:00", "18:00"],
    body: `Course C is point-to-point: tell us where to collect you and where you need to be.\n\nA driver meets you at the pickup point with the car you booked — an GT-R for the occasion, the van for luggage — and takes you directly to your destination. Two hours covers the whole Kanagawa area including airport and hotel transfers.\n\nBooking is per car, not per seat. Add the pickup and drop-off points at checkout.`,
    points: [
      { kind: "start", label: "Fujisawa base", lat: 35.3836, lng: 139.4131 },
      { kind: "poi", label: "Enoshima", lat: 35.2996, lng: 139.4808 },
      { kind: "poi", label: "Hakone", lat: 35.2324, lng: 139.1069 },
      { kind: "poi", label: "Fuji Speedway", lat: 35.3717, lng: 138.9267 },
    ],
  },
];

const FLEET = [
  {
    id: "r32",
    name: "Nissan Skyline GT-R R32",
    chassisCode: "BNR32",
    seats: 2,
    transmission: "5-speed manual",
    engineCode: "RB26DETT",
    drivetrain: "ATTESA AWD",
    luggage: "1 small bag",
    blurb:
      "The original Godzilla. 2.6-litre twin-turbo straight six, ATTESA all-wheel drive, and none of the driver aids that came later.",
    specs: ["2.6L I6 twin turbo", "5-speed manual", "ATTESA E-TS"],
    sort: 1,
  },
  {
    id: "r34",
    name: "Nissan Skyline GT-R R34",
    chassisCode: "BNR34",
    seats: 2,
    transmission: "6-speed manual",
    engineCode: "RB26DETT",
    drivetrain: "ATTESA AWD",
    luggage: "1 small bag",
    blurb:
      "The one on the posters. Sharper chassis than the R32, the same RB26, and a multifunction display straight out of a video game.",
    specs: ["2.6L I6 twin turbo", "6-speed manual", "ATTESA E-TS Pro"],
    sort: 2,
  },
  {
    id: "r35",
    name: "Nissan GT-R R35",
    chassisCode: "R35",
    seats: 2,
    transmission: "6-speed DCT",
    engineCode: "VR38DETT",
    drivetrain: "AWD",
    luggage: "1 small bag",
    blurb:
      "The modern answer. 3.8-litre twin-turbo V6, dual-clutch, and a chassis that makes fast drivers look faster.",
    specs: ["3.8L V6 twin turbo", "6-speed DCT", "Brembo carbon ceramic"],
    sort: 3,
  },
  {
    id: "ae86",
    name: "Toyota Sprinter Trueno AE86",
    chassisCode: "AE86",
    seats: 2,
    transmission: "5-speed manual",
    engineCode: "4A-GE",
    drivetrain: "RWD",
    luggage: "1 small bag",
    blurb:
      "Light, rear-drive, naturally aspirated. No turbo, no assists, no hiding — the car that taught a generation how to drive.",
    specs: ["1.6L I4 NA", "5-speed manual", "RWD"],
    sort: 4,
  },
  {
    id: "van",
    name: "Support Van",
    chassisCode: "VAN",
    kind: "van",
    seats: 6,
    transmission: "Automatic",
    engineCode: "2.0L diesel",
    drivetrain: "FWD",
    luggage: "Full luggage",
    blurb:
      "Luggage, passengers, or a camera crew. Book the van alongside a car when the group does not fit.",
    specs: ["6 seats", "Automatic", "Full luggage"],
    sort: 5,
  },
];

const PRICES: Record<string, Record<string, number>> = {
  "course-a": { r32: 55000, r34: 65000, r35: 70000, ae86: 45000, van: 60000 },
  "course-b": { r32: 45000, r34: 55000, r35: 60000, ae86: 35000, van: 40000 },
  "course-c": { r32: 25000, r34: 30000, r35: 32000, ae86: 20000, van: 28000 },
};

const SETTINGS: Record<string, string> = {
  brand_name: "TOKYORIDE",
  tagline: "JDM driving courses from Fujisawa",
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

export async function seedDatabase(): Promise<{
  courses: number;
  vehicles: number;
  departures: number;
  admin: string;
}> {
  const now = Date.now();

  await db.delete(webhookEvents);
  await db.delete(notifications);
  await db.delete(receipts);
  await db.delete(payments);
  await db.delete(bookingVehicles);
  await db.delete(bookings);
  await db.delete(customers);
  await db.delete(resourceBlocks);
  await db.delete(departures);
  await db.delete(tourRates);
  await db.delete(vehicles);
  await db.delete(tours);
  await db.delete(mapFeatures);
  await db.delete(media);
  await db.delete(inquiries);
  await db.delete(siteSettings);
  await db.delete(adminUsers);

  for (const course of COURSES) {
    await db.insert(tours).values({
      id: course.id,
      title: course.title,
      subtitle: course.subtitle,
      body: course.body,
      durationHours: course.durationHours,
      meetingLabel: course.meetingLabel,
      heroImage: null,
      status: "active",
      featured: course.featured,
      sort: course.sort,
      driverMode: course.driverMode,
      pickupDropoff: course.pickupDropoff,
      createdAt: now,
      updatedAt: now,
    });

    for (const [index, point] of course.points.entries()) {
      await db.insert(mapFeatures).values({
        id: newId("map"),
        ownerType: "tour",
        ownerId: course.id,
        kind: point.kind,
        label: point.label,
        lat: String(point.lat),
        lng: String(point.lng),
        sort: index,
      });
    }
  }

  for (const vehicle of FLEET) {
    await db.insert(vehicles).values({
      id: vehicle.id,
      name: vehicle.name,
      chassisCode: vehicle.chassisCode,
      kind: (vehicle as any).kind ?? "car",
      seats: vehicle.seats,
      luggage: vehicle.luggage,
      transmission: vehicle.transmission,
      engineCode: vehicle.engineCode,
      drivetrain: vehicle.drivetrain,
      photo: null,
      blurb: vehicle.blurb,
      specs: JSON.stringify(vehicle.specs),
      active: 1,
      sort: vehicle.sort,
      createdAt: now,
    });
  }

  for (const [courseId, prices] of Object.entries(PRICES)) {
    for (const [vehicleId, priceJpy] of Object.entries(prices)) {
      await db.insert(tourRates).values({
        id: newId("rate"),
        tourId: courseId,
        vehicleId,
        priceJpy,
        active: 1,
        updatedAt: now,
      });
    }
  }

  // 90 days of departures, every day, at each course's usual times.
  const today = jstDateKey(now);
  let created = 0;
  for (const course of COURSES) {
    for (let day = 0; day < 90; day++) {
      const dateKey = addDays(today, day);
      for (const time of course.times) {
        const startsAt = jstToUtc(dateKey, time);
        if (startsAt < now + 12 * 3600_000) continue;
        await db.insert(departures).values({
          id: newId("dep"),
          tourId: course.id,
          startsAt,
          endsAt: startsAt + course.durationHours * 3600_000,
          capacity: 4,
          status: "open",
          note: "",
          createdAt: now,
        });
        created++;
      }
    }
  }

  await db.insert(mapFeatures).values({
    id: newId("map"),
    ownerType: "site",
    ownerId: "",
    kind: "site",
    label: "Tokyoride base",
    lat: "35.383600",
    lng: "139.413100",
    sort: 0,
  });

  for (const [key, value] of Object.entries(SETTINGS)) {
    await db.insert(siteSettings).values({ key, value, updatedAt: now });
  }

  const email = env("ADMIN_EMAIL", "sam@tokyoride.co").toLowerCase();
  const password = env("ADMIN_PASSWORD", "tokyoride2026");
  const salt = newSalt();
  await db.insert(adminUsers).values({
    id: newId("usr"),
    email,
    name: "Sam",
    passwordHash: await hashPassword(password, salt),
    salt,
    createdAt: now,
  });

  return {
    courses: COURSES.length,
    vehicles: FLEET.length,
    departures: created,
    admin: email,
  };
}
