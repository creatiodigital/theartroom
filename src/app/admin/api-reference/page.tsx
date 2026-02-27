import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { isAdminOrAbove } from '@/lib/authUtils'
import { scanApiRoutes } from '@/lib/apiReference'
import { parseSchema } from '@/lib/schemaParser'

import ReferenceContent from './ReferenceContent'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'API & Database Reference — The Art Room',
}

export default async function ApiReferencePage() {
  // Auth gate: admin/superAdmin only
  const session = await auth()
  if (!session?.user || !isAdminOrAbove(session.user.userType)) {
    redirect('/dashboard/login')
  }

  // Scan routes and parse schema at render time
  const apiGroups = scanApiRoutes()
  const schema = parseSchema()
  const totalEndpoints = apiGroups.reduce((sum, g) => sum + g.routes.length, 0)

  return <ReferenceContent apiGroups={apiGroups} schema={schema} totalEndpoints={totalEndpoints} />
}
