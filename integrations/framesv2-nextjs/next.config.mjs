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
};

export default nextConfig;
