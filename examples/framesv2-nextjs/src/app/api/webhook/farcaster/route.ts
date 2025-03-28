import {
  ParseWebhookEvent,
  parseWebhookEvent,
  verifyAppKeyWithNeynar,
} from "@farcaster/frame-node";
import { NextRequest } from "next/server";
import { sendFrameNotification } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  const requestJson = await request.json();

  let data;
  try {
    data = await parseWebhookEvent(requestJson, verifyAppKeyWithNeynar);
  } catch (e: unknown) {
    const error = e as ParseWebhookEvent.ErrorType;

    switch (error.name) {
      case "VerifyJsonFarcasterSignature.InvalidDataError":
      case "VerifyJsonFarcasterSignature.InvalidEventDataError":
        // The request data is invalid
        return Response.json(
          { success: false, error: error.message },
          { status: 400 },
        );
      case "VerifyJsonFarcasterSignature.InvalidAppKeyError":
        // The app key is invalid
        return Response.json(
          { success: false, error: error.message },
          { status: 401 },
        );
      case "VerifyJsonFarcasterSignature.VerifyAppKeyError":
        // Internal error verifying the app key (caller may want to try again)
        return Response.json(
          { success: false, error: error.message },
          { status: 500 },
        );
    }
  }

  const fid = data.fid;
  const event = data.event;

  switch (event.event) {
    case "frame_added":
      if (event.notificationDetails) {
        await sendFrameNotification({
          notificationDetails: event.notificationDetails,
          title: "Welcome to XMTP x Frames v2",
          body: "Start chatting from a frame, use decentralized messaging on top of farcaster",
        });
      }
      break;
    case "frame_removed":
      break;
    case "notifications_enabled":
      await sendFrameNotification({
        notificationDetails: event.notificationDetails,
        title: "Notifications enabled 🔔",
        body: "You will now receive notifications for your XMTP Frames",
      });
      break;
    case "notifications_disabled":
      break;
  }

  return Response.json({ success: true });
}
