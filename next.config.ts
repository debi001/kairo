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
  // The App Router's client-side navigation settles on trailing-slash URLs
  // (e.g. /rhythm/draft-2/) regardless of this setting. Without it, export
  // writes sibling `draft-2.html` files instead of `draft-2/index.html` — a
  // hard reload or direct link to the trailing-slash URL then 404s / shows a
  // directory listing on static hosts. This makes both sides match.
  trailingSlash: true,
};

export default nextConfig;
