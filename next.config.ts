import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: prerender everything to `out/`, deployable to Cloudflare
  // Workers Static Assets with no adapter and no server runtime.
  output: "export",
  // next/image optimisation is unavailable without a server runtime.
  images: { unoptimized: true },
  // Emit `about/index.html` rather than `about.html` so nested routes resolve
  // on static hosts.
  trailingSlash: true,
};

export default nextConfig;
