import { env } from "@/lib/env";

export function createDMCastIntent(userFid: number) {
  const frameUrl = `https://www.warpcast.com/~/frames/launch?domain=${
    new URL(env.NEXT_PUBLIC_URL).hostname
  }`;
  const text = `Join me on XMTP private chat using this Farcaster Frames! ${frameUrl}`;
  const finalURL = `https://warpcast.com/~/inbox/create/${userFid}?text=${text}`;
  return finalURL;
}
