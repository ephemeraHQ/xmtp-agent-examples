/** @type {import('next').NextConfig} */
const nextConfig = {
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
  swcMinify: false,
  transpilePackages: ["@xmtp/browser-sdk", "@xmtp/node-sdk"],
};

export default nextConfig;
