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
};

export default nextConfig;
