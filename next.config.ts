import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent webpack from bundling these Node.js-only packages.
  // pdf-parse uses pdfjs-dist which calls Object.defineProperty on non-objects
  // when processed by the webpack RSC bundler.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
        port: "",
      },
      {
        protocol: "https",
        hostname: "images.clerk.dev",
        port: "",
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
