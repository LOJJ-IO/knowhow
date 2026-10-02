import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Hides the dev-only on-screen route indicator (the floating "N" in the
  // bottom-left). It sat over the "Proudly from Edmonton" mark and the Log In
  // sheet, which made screenshots misleading. Compile and runtime errors are
  // still surfaced. Next 16 dropped the old buildActivity options; `false` is
  // the supported switch (node_modules/next/dist/docs -> devIndicators).
  devIndicators: false,
  // In production the browser reaches the backend through this origin
  // (NEXT_PUBLIC_BACKEND_API_URL=/api), so its session cookies are
  // first-party. Locally the backend is called directly and this is unset.
  async rewrites() {
    const target = process.env.BACKEND_PROXY_TARGET;
    return target
      ? [{ source: "/api/:path*", destination: `${target}/:path*` }]
      : [];
  },
};

export default nextConfig;
