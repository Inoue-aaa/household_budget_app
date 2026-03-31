import { NextResponse } from "next/server";
import { runRecurringExpenseAutoApply } from "@/features/fixed-expenses/auto-apply";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  if (process.env.NODE_ENV !== "production" && !process.env.CRON_SECRET) {
    return true;
  }

  const vercelCronHeader = request.headers.get("x-vercel-cron");
  if (vercelCronHeader === "1") {
    return true;
  }

  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${configuredSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runRecurringExpenseAutoApply();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
