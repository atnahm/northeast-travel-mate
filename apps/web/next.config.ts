import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ne-mate/shared"],
  devIndicators: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
