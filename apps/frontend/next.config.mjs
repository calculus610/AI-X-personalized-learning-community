/** @type {import('next').NextConfig} */
const configuredBasePath = process.env.NEXT_PUBLIC_APP_BASE_PATH || ""
const basePath = configuredBasePath ? `/${configuredBasePath.replace(/^\/+|\/+$/g, "")}` : ""

const nextConfig = {
  output: "standalone",
  basePath,
  turbopack: {
    root: process.cwd(),
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
