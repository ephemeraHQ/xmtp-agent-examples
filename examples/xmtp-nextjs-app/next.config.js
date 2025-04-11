/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@helpers": path.resolve(__dirname, "../../helpers"),
    };
    return config;
  },
};

module.exports = nextConfig;
