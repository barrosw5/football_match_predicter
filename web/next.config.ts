import type { NextConfig } from "next";

// The site is a fully static export: the Python pipeline writes JSON into public/data and
// the GitHub Action rebuilds the site after every run. NEXT_PUBLIC_BASE_PATH is set when
// hosting under a sub-path (GitHub Pages project sites: "/<repo-name>").
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
