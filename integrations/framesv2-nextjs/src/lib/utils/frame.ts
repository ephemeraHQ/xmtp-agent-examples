import ky from "ky";
import { env } from "@/lib/env";

/**
 * Get the fonts for the frame from the public folder
 * @returns The fonts for the frame
 */
export async function getFonts(): Promise<
  {
    name: string;
    data: ArrayBuffer;
    weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    style: "normal" | "italic";
  }[]
> {
  const [font, fontBold] = await Promise.all([
    ky
      .get(`${env.NEXT_PUBLIC_URL}/fonts/inter-latin-ext-400-normal.woff`)
      .then((res) => res.arrayBuffer()),
    ky
      .get(`${env.NEXT_PUBLIC_URL}/fonts/inter-latin-ext-700-normal.woff`)
      .then((res) => res.arrayBuffer()),
  ]);
  return [
    {
      name: "Inter",
      data: font,
      weight: 400 as const,
      style: "normal" as const,
    },
    {
      name: "Inter",
      data: fontBold,
      weight: 700 as const,
      style: "normal" as const,
    },
  ];
}

/**
 * Get the farcaster manifest for the frame, generate yours from Warpcast Mobile
 *  On your phone to Settings > Developer > Domains > insert website hostname > Generate domain manifest
 * @returns The farcaster manifest for the frame
 */
export async function getFarcasterManifest() {
  return {
    accountAssociation: {
      header:
        "eyJmaWQiOjE4OTYzNiwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweDQ1QzViNUI3QzREMUQxMWQzNjVjZGZFRWFkMDMxNGFFMzZmRDYyRDUifQ",
      payload: "eyJkb21haW4iOiJ4bXRwLWZyYW1lc3YyLnZlcmNlbC5hcHAifQ",
      signature:
        "MHhkYTdiOTQwNDU0YjExNjkxYTdiMGU4MDQ5OTdhOGFjMzExMjk5NDlhYTQwOWNhMDQxMjkzYjIxMWYyZTAwMzNkNzAyNGZkYzQwY2JiNGVkZjJkODhhYjI3NWI5OGMwMzRhN2Q5M2RjZDVjYmE2ZTFlMTNkNmE3MzdjNGQ5MTQzNTFj",
    },
    frame: {
      version: "1",
      name: "XMTP Frames v2",
      iconUrl: `${env.NEXT_PUBLIC_URL}/images/icon.png`,
      homeUrl: env.NEXT_PUBLIC_URL,
      imageUrl: `${env.NEXT_PUBLIC_URL}/api/og`,
      buttonTitle: "Launch XMTP Frames v2",
      splashImageUrl: `${env.NEXT_PUBLIC_URL}/images/splash.png`,
      splashBackgroundColor: "#0d0d0d",
      webhookUrl: `${env.NEXT_PUBLIC_URL}/api/webhook/farcaster`,
    },
  };
}
