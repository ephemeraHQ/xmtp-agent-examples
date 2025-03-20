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
