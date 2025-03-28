import ky from "ky";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { NeynarUser } from "@/types";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  try {
    if (!searchParams.has("q")) {
      return NextResponse.json(
        {
          status: "nok",
          error: "query is required. Please specify a query",
        },
        { status: 400 },
      );
    }
    const apiResult = await ky.get<{
      result: {
        users: NeynarUser[];
      };
    }>(
      `https://api.neynar.com/v2/farcaster/user/search?${searchParams.toString()}`,
      {
        headers: {
          "x-api-key": `${env.NEYNAR_API_KEY}`,
        },
      },
    );
    if (apiResult.ok) {
      const farcasterData = await apiResult.json();
      return NextResponse.json({
        status: "ok",
        data: {
          users: farcasterData.result.users,
        },
      });
    } else {
      return NextResponse.json(
        {
          status: "nok",
          error: {
            ...(await apiResult.json()),
          },
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ status: "nok", error: error }, { status: 500 });
  }
}
