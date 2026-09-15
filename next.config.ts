import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  agentRules: false,
  output: "export",
  trailingSlash: true,
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
