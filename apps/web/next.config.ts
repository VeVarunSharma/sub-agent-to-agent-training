import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  outputFileTracingIncludes: {
    "/*": ["../../eval-reports/**/*", "./lib/fixtures/**/*"],
  },
};

export default nextConfig;
