import { NextResponse } from "next/server";
import { getBudgetAppShellSnapshot } from "@/features/app-shell/server";

export async function GET() {
  const snapshot = await getBudgetAppShellSnapshot();

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
