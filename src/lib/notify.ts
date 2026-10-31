import { asc, eq } from "drizzle-orm";
import { db } from "./db";
import { notifications } from "./db/schema";
import { newId } from "./ids";
import { env } from "./runtime";

export type NotificationInput = {
  bookingId?: string | null;
  kind: string;
  recipient: string;
  subject: string;
  body: string;
};

function wrap(subject: string, body: string): string {
  const paragraphs = body
    .split("\n")
    .map((line) =>
      line.trim() === ""
        ? "<div style='height:12px'></div>"
        : `<p style="margin:0 0 8px;font:15px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1a1a">${line
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")}</p>`,
    )
    .join("");

  return `<!doctype html><html><body style="margin:0;background:#0a0a0b;padding:24px">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#f4f2ec;border-radius:2px;overflow:hidden">
    <tr><td style="background:#0a0a0b;padding:18px 24px">
      <span style="font:700 20px/1 Arial,Helvetica,sans-serif;letter-spacing:.14em;color:#f4f2ec">TOKYORIDE</span>
    </td></tr>
    <tr><td style="padding:28px 24px">
      <h1 style="margin:0 0 18px;font:800 22px/1.25 Arial,Helvetica,sans-serif;color:#0a0a0b">${subject}</h1>
      ${paragraphs}
    </td></tr>
    <tr><td style="padding:16px 24px;border-top:1px solid #d8d4c9">
      <p style="margin:0;font:12px/1.5 Arial,Helvetica,sans-serif;color:#5a5a5a">Fujisawa, Kanagawa, Japan · tokyoride.co</p>
    </td></tr>
  </table>
  </td></tr></table></body></html>`;
}

async function deliver(id: string, recipient: string, subject: string, body: string) {
  const apiKey = env("RESEND_API_KEY");
  if (!apiKey) {
    console.log(`[email:queued] ${recipient} — ${subject}`);
    return { ok: true, simulated: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env("EMAIL_FROM", "Tokyoride <bookings@mail.tokyoride.co>"),
        to: [recipient],
        subject,
        html: wrap(subject, body),
        text: body,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text.slice(0, 300));
    }
    return { ok: true, simulated: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "send failed";
    await db
      .update(notifications)
      .set({ status: "failed", error: message })
      .where(eq(notifications.id, id));
    return { ok: false, simulated: false };
  }
}

export async function queueNotification(input: NotificationInput) {
  const id = newId("ntf");
  await db.insert(notifications).values({
    id,
    bookingId: input.bookingId ?? null,
    kind: input.kind,
    channel: "email",
    recipient: input.recipient,
    subject: input.subject,
    body: input.body,
    status: "queued",
    error: "",
    sentAt: null,
    createdAt: Date.now(),
  });

  const result = await deliver(id, input.recipient, input.subject, input.body);
  if (result.ok) {
    await db
      .update(notifications)
      .set({ status: "sent", sentAt: Date.now() })
      .where(eq(notifications.id, id));
  }
  return { id, ...result };
}

export async function retryQueued(limit = 20) {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.status, "queued"))
    .orderBy(asc(notifications.createdAt))
    .limit(limit);

  let sent = 0;
  for (const row of rows) {
    const result = await deliver(row.id, row.recipient, row.subject, row.body);
    if (result.ok) {
      await db
        .update(notifications)
        .set({ status: "sent", sentAt: Date.now() })
        .where(eq(notifications.id, row.id));
      sent++;
    }
  }
  return sent;
}
