import { ImageResponse } from "@vercel/og";
import { ConversationFrame } from "@/components/og/conversation-frame";
import { DefaultImage } from "@/components/og/default-image";
import { OG_IMAGE_SIZE } from "@/lib/constants";
import { getFonts } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(
  _: Request,
  {
    params,
  }: {
    params: Promise<{
      conversationId: string;
    }>;
  },
) {
  const { conversationId } = await params;
  try {
    const fonts = await getFonts();

    const defaultResponse = new ImageResponse(<DefaultImage />, {
      ...OG_IMAGE_SIZE,
      fonts: fonts,
    });

    // if no conversationId, return default image
    if (!conversationId) return defaultResponse;

    // generate dynamic image for conversation
    return new ImageResponse(
      <ConversationFrame conversationId={conversationId} />,
      {
        ...OG_IMAGE_SIZE,
        fonts: fonts,
        debug: false,
      },
    );
  } catch (e: unknown) {
    console.error(
      `[/api/og/${conversationId ?? "default"}] Error generating image:`,
      (e as Error).message,
    );
    return new ImageResponse(<DefaultImage />, {
      ...OG_IMAGE_SIZE,
    });
  }
}
