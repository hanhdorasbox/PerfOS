import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // xlsx and prisma use filesystem operations — mark as server-only external packages
  // to prevent Turbopack from over-tracing the project tree
  serverExternalPackages: ['xlsx', '@prisma/client', 'prisma'],

  // Silence the NFT tracing warning caused by dynamic fs access in lib/excel.ts
  outputFileTracingExcludes: {
    '*': ['**/*.xlsx', '**/data/**'],
  },

  // instrumentation.ts is picked up automatically in Next.js 15+ — no config needed
};

export default nextConfig;
