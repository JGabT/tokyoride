const base = process.env.BASE_URL ?? "http://localhost:4321";
const email = (process.env.ADMIN_EMAIL ?? "sam@tokyoride.co").toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "tokyoride2026";

async function main() {
  const login = await fetch(`${base}/api/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: base,
      Referer: `${base}/admin/login`,
    },
    body: new URLSearchParams({ email, password, next: "/admin" }).toString(),
    redirect: "manual",
  });

  const cookie = (login.headers.get("set-cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("tr_session="));

  if (!cookie) {
    console.log("No admin session (first run?) — seeding as bootstrap.");
  }

  const res = await fetch(`${base}/api/admin/seed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(cookie ? { Cookie: cookie } : {}),
      Origin: base,
      Referer: `${base}/admin/settings`,
    },
    body: "confirm=RESET",
    redirect: "manual",
  });

  if (res.status >= 400) {
    console.error(`Seed failed: ${res.status}`);
    process.exit(1);
  }

  console.log(`Seeded courses, fleet and departures at ${base}.`);
  console.log(`Admin: ${email}`);
}

main();
