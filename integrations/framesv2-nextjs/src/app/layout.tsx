import "./globals.css";
import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { headers } from "next/headers";
import { Providers } from "@/providers";

const montserrat = Montserrat({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "XMTP Frames v2",
  description: "XMTP Frames v2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookies = headers().get("cookie");

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${montserrat.className} size-full antialiased max-h-screen overflow-y-hidden`}>
        <Providers cookies={cookies}>{children}</Providers>
      </body>
    </html>
  );
}
