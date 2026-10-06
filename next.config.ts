import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  transpilePackages: ["react-globe.gl", "three-globe"],
  outputFileTracingIncludes: { "/*": ["./data/live.json"], "/**/*": ["./data/live.json"] },};

export default nextConfig;
