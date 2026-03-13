import type { NextConfig } from "next";

const basePath = "/nlp-unam";

const nextConfig: NextConfig = {
  output: "export",        // generates a fully static `out/` folder
  basePath,                // matches https://milmor.github.io/nlp-unam/
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,  // available in components for asset paths
  },
  images: {
    unoptimized: true,     // required for static export (no Next.js image server)
  },
};

export default nextConfig;
