import { cookies } from 'next/headers'
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'

import prisma from '@/lib/prisma'
import { rateLimit } from '@/lib/rateLimit'
import { getClientIpFromHeaders } from '@/lib/getClientIp'
import { IMPERSONATION_COOKIE, readImpersonation } from '@/lib/impersonation'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        loginCode: { label: 'Login Code', type: 'text' },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email as string
        const password = credentials.password as string
        const loginCode = credentials.loginCode as string | undefined

        // Brute-force protection on the credentials callback — otherwise
        // unthrottled, so an attacker could hammer this endpoint to guess a
        // password OR sweep the 6-digit login code (a wrong code neither locks
        // the account nor rotates the code within its TTL). Cap attempts per
        // account, and per source IP when available (credential stuffing).
        // Fails open if the limiter store is unreachable.
        const ip = request?.headers ? getClientIpFromHeaders(request.headers) : null
        const [emailGate, ipGate] = await Promise.all([
          rateLimit({
            name: 'login-email',
            key: email.toLowerCase(),
            limit: 8,
            windowSeconds: 900,
          }),
          ip
            ? rateLimit({ name: 'login-ip', key: ip, limit: 40, windowSeconds: 900 })
            : Promise.resolve({ success: true, remaining: 1 }),
        ])
        if (!emailGate.success || !ipGate.success) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user || !user.password) {
          return null
        }

        const passwordMatch = await bcrypt.compare(password, user.password)

        if (!passwordMatch) {
          return null
        }

        // If user must change password (provisional), skip OTP and allow login
        if (user.mustChangePassword) {
          // Clear any existing login code
          await prisma.user.update({
            where: { id: user.id },
            data: { loginCode: null, loginCodeExpiry: null },
          })

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            handler: user.handler,
            userType: user.userType,
            mustChangePassword: true,
          }
        }

        // Local-dev escape hatch: when SKIP_LOGIN_OTP=true outside
        // production, password-only login is enough. Mirrors the same
        // flag in /api/auth/send-login-code. Staging + production
        // ignore this because NODE_ENV is "production".
        const skipOtp =
          process.env.NODE_ENV !== 'production' && process.env.SKIP_LOGIN_OTP === 'true'

        if (!skipOtp) {
          // Normal flow: require login code
          if (!loginCode) {
            return null
          }

          // Verify login code
          if (!user.loginCode || user.loginCode !== loginCode) {
            return null
          }

          // Check if code has expired
          if (!user.loginCodeExpiry || new Date() > user.loginCodeExpiry) {
            return null
          }
        }

        // Clear the login code after successful authentication
        await prisma.user.update({
          where: { id: user.id },
          data: {
            loginCode: null,
            loginCodeExpiry: null,
          },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          handler: user.handler,
          userType: user.userType,
          mustChangePassword: false,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.handler = (user as { handler?: string }).handler
        token.userType = (user as { userType?: string }).userType
        token.mustChangePassword =
          (user as { mustChangePassword?: boolean }).mustChangePassword ?? false
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.handler = token.handler as string

        // Fetch fresh userType from database to ensure role changes take effect immediately
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { userType: true, mustChangePassword: true },
          })
          session.user.userType = dbUser?.userType ?? (token.userType as string)
          session.user.mustChangePassword =
            dbUser?.mustChangePassword ?? (token.mustChangePassword as boolean) ?? false
        } catch {
          // Fallback to token if DB lookup fails
          session.user.userType = token.userType as string
        }
      }

      // Impersonation comes from its own cookie, re-checked against the real
      // user on every read — never from the token (see lib/impersonation).
      if (session.user) {
        const impersonating = await readImpersonation(session.user.id, session.user.userType)
        if (impersonating) session.impersonating = impersonating
      }

      return session
    },
  },
  events: {
    // Logging out ends an impersonation too — otherwise the same admin logging
    // back in, in the same browser session, would resume it.
    async signOut() {
      ;(await cookies()).delete(IMPERSONATION_COOKIE)
    },
  },
  pages: {
    signIn: '/dashboard/login',
  },
  session: {
    strategy: 'jwt',
  },
})
