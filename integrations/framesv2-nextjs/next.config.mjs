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
  experimental: {
    serverComponentsExternalPackages: ["@xmtp/node-sdk"],
  },
};

export default nextConfig;
