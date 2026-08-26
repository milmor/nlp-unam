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
  // Local convenience: bare localhost:3000 → course site (ignored by static export)
  async redirects() {
    return [
      {
        source: "/",
        destination: basePath,
        permanent: false,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
