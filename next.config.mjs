/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Traced, self-contained server bundle. Cuts the runtime image from ~1GB to
  // tens of MB and removes the need for node_modules in production.
  // Note: public/ and .next/static are NOT included, the Dockerfile copies them.
  output: "standalone",

  // The pitch deck is a static bundle in public/deck. Next serves
  // public/deck/index.html only at its full path, so map the bare /deck onto it.
  // The deployed copy carries <base href="/deck/"> so its relative asset paths
  // still resolve from that URL (see pitch-deck/build/deploy.sh).
  async rewrites() {
    return [{ source: "/deck", destination: "/deck/index.html" }];
  },
};

export default nextConfig;
