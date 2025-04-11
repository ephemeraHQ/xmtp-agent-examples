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
  transpilePackages: ["@xmtp/wasm-bindings"],
  experimental: {
    serverComponentsExternalPackages: ["@xmtp/node-bindings"],
    esmExternals: "loose",
  },
};

export default nextConfig;
