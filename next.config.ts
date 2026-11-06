import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["better-sqlite3", "@napi-rs/canvas"],
  // Route handlers read these with fs at runtime, so Vercel must bundle them into the functions.
  outputFileTracingIncludes: {
    "/api/**": ["./data/hanapmeme.db", "./data/memes/**", "./assets/fonts/**", "./public/templates/**"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // CORS is open for GET only. POST routes stay same-origin.
  async headers() {
    return ["/api/search", "/api/memes/:path*"].map((source) => ({
      source,
      headers: [
        { key: "Access-Control-Allow-Origin", value: "*" },
        { key: "Access-Control-Allow-Methods", value: "GET" },
      ],
    }));
  },
};

export default nextConfig;
