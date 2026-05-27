import { NextResponse } from "next/server";
import { loadCommandCenterState } from "@/app/lib/office";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await loadCommandCenterState());
}
