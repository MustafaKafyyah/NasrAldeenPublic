import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * A static export: `next build` writes plain HTML/CSS/JS into `out/`, which
   * is uploaded to Cloudflare Pages as-is. There is no server, so there is
   * nothing to keep running and nothing that can write to the data file.
   *
   * `redirects()` lives in the server that no longer exists, so the bare root
   * is sent to /ar by `public/_redirects` (Cloudflare Pages reads it) with
   * `public/index.html` as a belt-and-braces fallback.
   */
  output: "export",
};

export default nextConfig;
