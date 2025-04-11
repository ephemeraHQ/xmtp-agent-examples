/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ["@xmtp/node-sdk", "@xmtp/browser-sdk"],
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@helpers": path.resolve(__dirname, "../../helpers"),
    };

    // Handle node-specific modules in the browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        path: false,
        os: false,
        util: false,
        url: false,
        assert: false,
        buffer: false,
        process: false,
      };
    }

    // Exclude problematic modules from being processed
    config.module.rules.push({
      test: /\.js$/,
      include: /node_modules\/@xmtp/,
      use: {
        loader: "ignore-loader",
      },
    });

    return config;
  },
};

module.exports = nextConfig;
