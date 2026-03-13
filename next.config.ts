import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",        // generates a fully static `out/` folder
  basePath: "/nlp-unam",   // matches https://milmor.github.io/nlp-unam/
  images: {
    unoptimized: true,     // required for static export (no Next.js image server)
  },
};

export default nextConfig;
