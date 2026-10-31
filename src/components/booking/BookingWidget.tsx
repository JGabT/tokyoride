import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar } from "@/components/ui/calendar";

export type FleetOption = {
  id: string;
  name: string;
  chassisCode: string;
  seats: number;
  priceJpy: number;
  transmission: string;
  photo?: string | null;
};

export type DepartureOption = {
  id: string;
  startsAt: number;
  vehiclesLeft: string[];
};

type Props = {
  tourId: string;
  tourTitle: string;
  meetingLabel: string;
  driverMode: "self" | "staff";
  pickupDropoff: boolean;
  fleet: FleetOption[];
  departures: DepartureOption[];
  policy: string;
};

const jstDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const jstTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function yen(n: number) {
  return `¥${n.toLocaleString("en-US")}`;
}

function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

function dateToKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const inputClass =
  "w-full border border-ink/20 bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-ink/45 focus:border-signal focus:outline-none";
const labelClass = "mono-label mb-1.5 block text-ink/65";

export default function BookingWidget({
  tourId,
  tourTitle,
  meetingLabel,
  driverMode,
  pickupDropoff,
  fleet,
  departures,
  policy,
}: Props) {
  const selfDrive = driverMode === "self";
  const byDate = useMemo(() => {
    const map = new Map<string, DepartureOption[]>();
    for (const dep of [...departures].sort((a, b) => a.startsAt - b.startsAt)) {
      const key = jstDate.format(new Date(dep.startsAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(dep);
    }
    return map;
  }, [departures]);

  const dateKeys = useMemo(() => [...byDate.keys()].sort(), [byDate]);
  const availableDates = useMemo(() => dateKeys.map(keyToDate), [dateKeys]);

  const [dateKey, setDateKey] = useState(dateKeys[0] ?? "");
  const [departureId, setDepartureId] = useState(
    byDate.get(dateKeys[0] ?? "")?.[0]?.id ?? "",
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [drivers, setDrivers] = useState<Record<string, Record<string, string>>>({});
  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    country: "",
  });
  const [notes, setNotes] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const dayDepartures = byDate.get(dateKey) ?? [];
  const selectedDate = dateKey ? keyToDate(dateKey) : undefined;
  const firstDate = dateKeys.length ? keyToDate(dateKeys[0]) : undefined;
  const lastDate = dateKeys.length
    ? keyToDate(dateKeys[dateKeys.length - 1])
    : undefined;
  const departure = dayDepartures.find((d) => d.id === departureId) ?? dayDepartures[0];
  const available = new Set(departure?.vehiclesLeft ?? []);
  const cars = fleet.filter((v) => selected.includes(v.id));
  const total = cars.reduce((sum, v) => sum + v.priceJpy, 0);

  // Deep links from the fleet page: /courses/<id>?vehicle=<vehicleId>
  // Pre-select that car on the first departure it is still free for, then
  // glide down to the widget so the sticky header never covers it.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("vehicle");
    if (!wanted || !fleet.some((v) => v.id === wanted)) return;

    const dep = [...departures]
      .sort((a, b) => a.startsAt - b.startsAt)
      .find((d) => d.vehiclesLeft.includes(wanted));

    if (dep) {
      setDateKey(jstDate.format(new Date(dep.startsAt)));
      setDepartureId(dep.id);
      setSelected([wanted]);
      setDrivers((d) => ({
        ...d,
        [wanted]: d[wanted] ?? { name: "", country: "", license: "", idp: "", dob: "" },
      }));
    }

    const el = rootRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    // Runs once on mount; the query string does not change in-app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickDate(key: string) {
    setDateKey(key);
    const first = byDate.get(key)?.[0];
    setDepartureId(first?.id ?? "");
    setSelected([]);
  }

  function toggleCar(id: string) {
    setError("");
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (!available.has(id)) {
        setError("That car is already taken for this time slot.");
        return prev;
      }
      setDrivers((d) => ({
        ...d,
        [id]: d[id] ?? { name: "", country: "", license: "", idp: "", dob: "" },
      }));
      return [...prev, id];
    });
  }

  function setDriver(id: string, field: string, value: string) {
    setDrivers((d) => ({
      ...d,
      [id]: { ...(d[id] ?? {}), [field]: value },
    }));
  }

  async function submit() {
    setError("");
    if (!departure) return setError("Pick a date first.");
    if (!selected.length) return setError("Select at least one car.");
    if (!customer.name || !customer.email) return setError("Add your name and email.");
    if (pickupDropoff && (!pickup.trim() || !dropoff.trim())) {
      return setError("Add your pickup and drop-off points.");
    }
    for (const id of selected) {
      const d = drivers[id];
      if (!d?.name) {
        const car = fleet.find((v) => v.id === id);
        return setError(`Add a ${selfDrive ? "driver" : "lead passenger"} for the ${car?.name ?? "car"}.`);
      }
      if (selfDrive && (!d?.license || !d?.country)) {
        const car = fleet.find((v) => v.id === id);
        return setError(`Complete the license details for the ${car?.name ?? "car"}.`);
      }
    }

    setBusy(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tourId,
          departureId: departure.id,
          vehicleIds: selected,
          customer,
          drivers: Object.fromEntries(selected.map((id) => [id, drivers[id]])),
          notes,
          pickup: pickupDropoff ? pickup : undefined,
          dropoff: pickupDropoff ? dropoff : undefined,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start checkout.");
        setBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  if (!dateKeys.length) {
    return (
      <div className="card-surface p-6">
        <p className="mono-label text-utility">No departures</p>
        <p className="mt-2 text-sm text-ink/75">
          No dates are open right now. Send us a message and we will schedule a run.
        </p>
        <a href="/contact" className="hard-btn mt-4">Contact us</a>
      </div>
    );
  }

  let step = 3;
  const pickupStep = pickupDropoff ? String(step++).padStart(2, "0") : null;
  const peopleStep = String(step++).padStart(2, "0");
  // The passenger step only exists once a car is chosen; don't skip a number
  // before that.
  const contactStep = cars.length ? String(step).padStart(2, "0") : peopleStep;

  return (
    <div className="card-surface scroll-mt-24" ref={rootRef}>
      <div className="border-b border-ink/10 p-5">
        <p className="section-label">Reserve</p>
        <p className="mt-1 font-display text-2xl leading-none text-ink">
          {tourTitle}
        </p>
        <p className="mono-label mt-2 text-ink/55">{meetingLabel}</p>
      </div>

      {/* 1. date */}
      <div className="border-b border-ink/10 p-5">
        <div className="mb-1 flex items-baseline justify-between">
          <p className="mono-label text-ink/55">01 / Pickup date</p>
          <p className="mono-label text-ink/40">{dateKeys.length} dates open</p>
        </div>

        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && pickDate(dateToKey(date))}
          disabled={(date) => !byDate.has(dateToKey(date))}
          startMonth={firstDate}
          endMonth={lastDate}
          defaultMonth={selectedDate}
          weekStartsOn={1}
          modifiers={{ available: availableDates }}
          modifiersClassNames={{ available: "available" }}
          className="booking-calendar w-full p-0"
        />

        <p className="mono-label mt-1 flex items-center gap-1.5 text-ink/40">
          <span className="size-1 bg-signal" />
          Red dot = departure available
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {dayDepartures.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setDepartureId(d.id);
                setSelected((prev) => prev.filter((id) => d.vehiclesLeft.includes(id)));
              }}
              className={`border px-3 py-2 font-mono text-xs tracking-widest transition-colors ${
                departure?.id === d.id
                  ? "border-signal text-signal"
                  : "border-ink/20 text-ink/85 hover:border-ink/50"
              }`}
            >
              {jstTime.format(new Date(d.startsAt))}
              <span className="ml-2 text-xs opacity-60">
                {d.vehiclesLeft.length} left
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. cars */}
      <div className="border-b border-ink/10 p-5">
        <p className="mono-label mb-3 text-ink/55">02 / Choose your car(s)</p>
        <div className="space-y-2">
          {fleet.map((car) => {
            const isFree = available.has(car.id);
            const isPicked = selected.includes(car.id);
            return (
              <button
                key={car.id}
                type="button"
                onClick={() => toggleCar(car.id)}
                disabled={!isFree}
                className={`flex w-full items-center justify-between gap-3 border p-3 text-left transition-colors ${
                  isPicked
                    ? "border-signal bg-signal/10"
                    : isFree
                      ? "border-ink/15 hover:border-ink/40"
                      : "cursor-not-allowed border-ink/5 opacity-35"
                }`}
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center border ${
                      isPicked ? "border-signal bg-signal text-white" : "border-ink/30"
                    }`}
                  >
                    {isPicked && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-tight text-ink">{car.name}</span>
                    <span className="mono-label mt-1 block text-xs leading-tight text-ink/55">
                      {car.chassisCode} · {car.seats} seats
                    </span>
                  </span>
                </span>
                <span className="shrink-0 font-mono text-sm text-ink">{yen(car.priceJpy)}</span>
              </button>
            );
          })}
        </div>
        <p className="mono-label mt-3 text-ink/50">
          {selfDrive
            ? "Add more than one car for a convoy — one driver per car."
            : "Add more than one car for a convoy — each car comes with its own driver."}
        </p>
      </div>

      {pickupDropoff && pickupStep && (
        <div className="border-b border-ink/10 p-5">
          <p className="mono-label mb-3 text-ink/55">{pickupStep} / Pickup & drop-off</p>
          <div className="space-y-2">
            <div>
              <label className={labelClass}>Pickup point</label>
              <input
                className={inputClass}
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                placeholder="Hotel, station or address"
              />
            </div>
            <div>
              <label className={labelClass}>Drop-off point</label>
              <input
                className={inputClass}
                value={dropoff}
                onChange={(e) => setDropoff(e.target.value)}
                placeholder="Where you need to be"
              />
            </div>
          </div>
          <p className="mono-label mt-2 text-ink/40">
            Two hours covers Kanagawa, including airport and hotel transfers.
          </p>
        </div>
      )}

      {/* 3. drivers */}
      {cars.length > 0 && (
        <div className="border-b border-ink/10 p-5">
          <p className="mono-label mb-3 text-ink/55">
            {peopleStep} / {selfDrive ? "Driver details" : "Lead passenger"}
          </p>
          <div className="space-y-4">
            {cars.map((car) => (
              <fieldset key={car.id} className="border border-ink/10 p-3">
                <legend className="mono-label px-1 text-signal">
                  {car.chassisCode || car.name}
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>
                      {selfDrive ? "Driver name" : "Lead passenger"}
                    </label>
                    <input
                      className={inputClass}
                      value={drivers[car.id]?.name ?? ""}
                      onChange={(e) => setDriver(car.id, "name", e.target.value)}
                      placeholder={selfDrive ? "As on license" : "Full name"}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Nationality</label>
                    <input
                      className={inputClass}
                      value={drivers[car.id]?.country ?? ""}
                      onChange={(e) => setDriver(car.id, "country", e.target.value)}
                      placeholder={selfDrive ? "Required for the license" : "Optional"}
                    />
                  </div>
                  {selfDrive && (
                    <>
                      <div>
                        <label className={labelClass}>License number</label>
                        <input
                          className={inputClass}
                          value={drivers[car.id]?.license ?? ""}
                          onChange={(e) => setDriver(car.id, "license", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>IDP number</label>
                        <input
                          className={inputClass}
                          value={drivers[car.id]?.idp ?? ""}
                          onChange={(e) => setDriver(car.id, "idp", e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>
              </fieldset>
            ))}
          </div>
        </div>
      )}

      {/* 4. contact */}
      <div className="border-b border-ink/10 p-5">
        <p className="mono-label mb-3 text-ink/55">{contactStep} / Contact</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass}>Full name</label>
            <input
              className={inputClass}
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              className={inputClass}
              value={customer.email}
              onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input
              className={inputClass}
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Notes (optional)</label>
            <textarea
              rows={2}
              className={inputClass}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Flight number, pickup request, second driver…"
            />
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="mono-label text-ink/55">Total</p>
            <p className="font-mono text-3xl font-bold leading-none tracking-tight text-ink">
              {cars.length ? yen(total) : "—"}
            </p>
            <p className="mono-label mt-1 text-ink/50">
              {cars.length ? "Tax included · per car" : "Select a car to see the total"}
            </p>
          </div>
          {cars.length > 1 && (
            <span className="plate text-signal">
              <small>CONVOY</small>
              <span>{cars.length} CARS</span>
            </span>
          )}
        </div>

        {error && (
          <p className="mb-3 border border-signal/40 bg-signal/10 px-3 py-2 text-xs text-ink">
            {error}
          </p>
        )}

        <button
          onClick={submit}
          disabled={busy || cars.length === 0}
          className="hard-btn w-full disabled:opacity-50"
        >
          {busy ? "Opening checkout…" : cars.length ? `Pay ${yen(total)}` : "Select a car"}
        </button>
        <p className="mono-label mt-3 text-center text-ink/50">
          Card payment · AirPay secured checkout
        </p>
        <p className="mt-3 text-xs leading-relaxed text-ink/55">{policy}</p>
      </div>
    </div>
  );
}
