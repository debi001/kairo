import type { NextConfig } from "next";

// GitHub Pages serves the site from https://<user>.github.io/<repo>/, so when
// the Pages workflow builds it we need a base path. Local dev / Vercel don't.
const REPO = "kairo";
const onPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  // Fully client-rendered — export plain HTML so it deploys anywhere.
  output: "export",
  images: { unoptimized: true },
  basePath: onPages ? `/${REPO}` : "",
  assetPrefix: onPages ? `/${REPO}/` : "",
};

export default nextConfig;
