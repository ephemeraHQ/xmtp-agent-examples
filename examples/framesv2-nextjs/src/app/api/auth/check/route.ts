import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const userFid = request.headers.get("x-user-id");
  if (!userFid) {
    return NextResponse.json({ userFid: null }, { status: 404 });
  }

  return NextResponse.json({ userFid }, { status: 200 });
}
