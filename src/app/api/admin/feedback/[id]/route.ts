import { NextResponse, type NextRequest } from 'next/server'

import { requireAdminOrAbove } from '@/lib/authUtils'
import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'
import { isSameOrigin } from '@/lib/sameOrigin'

/**
 * Admin · Gallery › Feedback (F1, docs/admin-redesign/feedback-list.md): delete one visitor
 * feedback for good. The list itself is read by the page on the server, so there is no GET here.
 *
 * - a signed-in admin only (401 / 403, requireAdminOrAbove);
 * - from this site only: a browser sends `Origin` on every DELETE, so a forged cross-site request
 *   is refused (403);
 * - the id must look like one (400), and one already gone is a 404;
 * - never cached; errors are generic and never carry the visitor's message.
 *
 * Only DELETE is exported: any other method gets Next's 405.
 */

const json = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return json({ error: 'Invalid request.' }, 403)

  const { error: authError } = await requireAdminOrAbove()
  if (authError) return authError

  const { id } = await context.params
  if (!UUID.test(id)) return json({ error: 'Invalid request.' }, 400)

  try {
    const { count } = await prisma.feedback.deleteMany({ where: { id } })
    // Already deleted (another tab, a double press): nothing to do, and the list says so.
    if (count === 0) return json({ error: 'This feedback was already deleted.' }, 404)
    return json({ success: true })
  } catch (error) {
    captureError(error, {
      flow: 'admin',
      stage: 'admin-feedback-delete',
      fingerprint: ['content:admin-feedback-delete'],
    })
    return json({ error: "Couldn't delete this feedback. Please try again." }, 500)
  }
}
