import { NextRequest, NextResponse } from "next/server";

// Simple response for now to get the build working
export async function GET() {
  return NextResponse.json({ status: "XMTP API is running" });
}

export async function POST(request: NextRequest) {
  try {
    const { message, clientAddress } = await request.json();

    if (!message || !clientAddress) {
      return NextResponse.json(
        { error: "Message and client address are required" },
        { status: 400 },
      );
    }

    // For now, just return a success response
    return NextResponse.json({
      success: true,
      message: "Message would be sent to " + clientAddress,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}
