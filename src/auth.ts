import { cookies } from 'next/headers'
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

import { verifyPassword } from '@/lib/auth/verifyPassword'
import prisma from '@/lib/prisma'
import { rateLimit } from '@/lib/rateLimit'
import { getClientIpFromHeaders } from '@/lib/getClientIp'
import { IMPERSONATION_COOKIE, readImpersonation } from '@/lib/impersonation'

// Signed in for at most 30 days from login, however actively the session is used.
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

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
        if (typeof credentials?.email !== 'string' || typeof credentials?.password !== 'string') {
          return null
        }
        if (!credentials.email || !credentials.password) {
          return null
        }

        const email = credentials.email
        const password = credentials.password
        const loginCode =
          typeof credentials.loginCode === 'string' ? credentials.loginCode : undefined

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

        // Same bcrypt cost whether or not the account exists (see
        // verifyPassword), so response time can't reveal which emails do.
        const passwordMatch = await verifyPassword(password, user?.password)

        if (!user || !passwordMatch) {
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
    // Returning null ends the session: Auth.js clears the cookie and `auth()`
    // then has no session at all, so every `!session?.user` guard refuses.
    async jwt({ token, user }) {
      const now = Math.floor(Date.now() / 1000)

      if (user) {
        token.id = user.id
        token.handler = (user as { handler?: string }).handler
        token.userType = (user as { userType?: string }).userType
        token.mustChangePassword =
          (user as { mustChangePassword?: boolean }).mustChangePassword ?? false
        token.loginAt = now
        return token
      }

      // Absolute lifetime. The cookie is re-signed with a fresh expiry on every
      // read, so on its own a session in regular use never ends. A token from
      // before this cap has no login time: it starts counting now.
      const loginAt = typeof token.loginAt === 'number' ? token.loginAt : now
      token.loginAt = loginAt
      if (now - loginAt > SESSION_MAX_AGE_SECONDS) return null

      // Fresh role from the database, so role changes take effect immediately —
      // and a deleted account ends its session instead of carrying the role the
      // token was issued with. A failed lookup (DB unreachable) keeps the token's
      // values rather than logging everyone out.
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { userType: true, mustChangePassword: true },
        })
        if (!dbUser) return null
        token.userType = dbUser.userType
        token.mustChangePassword = dbUser.mustChangePassword
      } catch {
        // Keep the token's values.
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.handler = token.handler as string
        session.user.userType = token.userType as string
        session.user.mustChangePassword = (token.mustChangePassword as boolean) ?? false
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
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
})
