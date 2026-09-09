import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The playground is fully client-rendered with no server needs, so export
  // plain HTML — deploys anywhere (Vercel, Netlify, GitHub Pages, S3...).
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
