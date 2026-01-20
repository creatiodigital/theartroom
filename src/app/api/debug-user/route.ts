import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'

// Temporary debug endpoint - DELETE AFTER USE
export async function GET() {
  const user = await prisma.user.findFirst({
    where: { email: 'contact@creatio.art' },
    select: { id: true, email: true, userType: true, name: true },
  })
  return NextResponse.json({ user })
}

// Temporary POST to promote to superAdmin - DELETE AFTER USE
export async function POST() {
  const user = await prisma.user.update({
    where: { email: 'contact@creatio.art' },
    data: { userType: 'superAdmin' },
    select: { id: true, email: true, userType: true, name: true },
  })
  return NextResponse.json({ user, message: 'Updated to superAdmin' })
}
