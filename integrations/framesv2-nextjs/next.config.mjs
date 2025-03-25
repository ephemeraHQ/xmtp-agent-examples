import { fileURLToPath } from "node:url";
import createJITI from "jiti";

const jiti = createJITI(fileURLToPath(import.meta.url));

jiti("./src/lib/env.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: {
    appIsrStatus: false,
  },
  images: {
    remotePatterns: [
      {
        hostname: "**",
        protocol: "https",
      },
    ],
  },
  transpilePackages: [
    "@xmtp/wasm-bindings",
    "@xmtp/content-type-group-updated",
    "@xmtp/content-type-primitives",
    "@xmtp/content-type-text",
    "@xmtp/content-type-reaction",
    "@xmtp/content-type-remote-attachment",
    "@xmtp/content-type-reply",
  ],
  experimental: {
    serverComponentsExternalPackages: [
      "node:path",
      "node:fs/promises",
      "node:process",
      "node:module",
      "@xmtp/node-bindings",
      "@xmtp/node-bindings/version.json",
      "@xmtp/proto",
    ],
    esmExternals: "loose",
  },
};

export default nextConfig;
