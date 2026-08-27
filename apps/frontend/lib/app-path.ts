const configuredBasePath = process.env.NEXT_PUBLIC_APP_BASE_PATH ?? ""

export const appBasePath = configuredBasePath
  ? `/${configuredBasePath.replace(/^\/+|\/+$/g, "")}`
  : ""

export function withAppBasePath(path: string) {
  if (!path.startsWith("/") || path.startsWith(`${appBasePath}/`)) return path
  return `${appBasePath}${path}`
}
