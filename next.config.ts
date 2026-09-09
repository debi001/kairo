import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is fully static — export plain HTML so it deploys anywhere
  // (Vercel, Netlify, GitHub Pages, S3...) with no server runtime.
  output: "export",
  images: { unoptimized: true },
  // pin the workspace root to this folder (repo root) so Next doesn't walk
  // up into a parent directory looking for a lockfile
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
