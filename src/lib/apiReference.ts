import fs from 'fs'
import path from 'path'

export interface ApiRoute {
  path: string
  methods: string[]
  isDynamic: boolean
  params: string[]
}

export interface ApiGroup {
  name: string
  routes: ApiRoute[]
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const

/**
 * Scan the src/app/api directory and extract all route handlers.
 * Works at build/render time via fs — no runtime cost.
 */
export function scanApiRoutes(): ApiGroup[] {
  const apiDir = path.join(process.cwd(), 'src', 'app', 'api')
  const routeFiles = findRouteFiles(apiDir)

  const routes: ApiRoute[] = routeFiles.map((filePath) => {
    const relativePath = path.relative(apiDir, filePath)
    const urlPath = buildUrlPath(relativePath)
    const methods = extractMethods(filePath)
    const params = extractParams(urlPath)

    return {
      path: `/api/${urlPath}`,
      methods,
      isDynamic: params.length > 0,
      params,
    }
  })

  // Group by top-level resource
  const groups = new Map<string, ApiRoute[]>()
  for (const route of routes) {
    const resource = route.path.split('/')[2] || 'root'
    if (!groups.has(resource)) groups.set(resource, [])
    groups.get(resource)!.push(route)
  }

  // Sort groups alphabetically and routes within each group by path
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, groupRoutes]) => ({
      name,
      routes: groupRoutes.sort((a, b) => a.path.localeCompare(b.path)),
    }))
}

/** Recursively find all route.ts files */
function findRouteFiles(dir: string): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findRouteFiles(fullPath))
    } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
      results.push(fullPath)
    }
  }
  return results
}

/** Convert file path like "artworks/[id]/image/route.ts" → "artworks/:id/image" */
function buildUrlPath(relativePath: string): string {
  return relativePath
    .replace(/\/route\.(ts|js)$/, '') // Remove route.ts
    .replace(/\[\.\.\.(\w+)\]/g, '*$1') // [...slug] → *slug
    .replace(/\[(\w+)\]/g, ':$1') // [id] → :id
}

/** Read route file and find exported HTTP methods */
function extractMethods(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  return HTTP_METHODS.filter((method) =>
    new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`).test(content),
  )
}

/** Extract dynamic param names from URL path */
function extractParams(urlPath: string): string[] {
  const matches = urlPath.match(/:(\w+)/g)
  return matches ? matches.map((m) => m.slice(1)) : []
}
