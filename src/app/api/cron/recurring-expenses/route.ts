import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      mode: "manual-recurring-candidates",
      message: "Automatic recurring expense application is disabled.",
    },
    { status: 410 },
  );
}
