import { NextResponse } from "next/server";
import { z } from "zod";
import { addUserToDefaultGroupChat } from "@/lib/xmtp";

// Input validation schema
const joinChatSchema = z.object({
  inboxId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { inboxId } = joinChatSchema.parse(body);

    // Initialize XMTP client
    const success = await addUserToDefaultGroupChat(inboxId);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to add user to group chat" },
        { status: 500 },
      );
    }
    return NextResponse.json({
      success,
      message: `Successfully added ${inboxId} to the group chat`,
    });
  } catch (error) {
    console.error("Error joining chat:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: "Failed to join chat" }, { status: 500 });
  }
}
