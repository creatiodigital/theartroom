import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'

import prisma from '@/lib/prisma'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email as string
        const password = credentials.password as string

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

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          handler: user.handler,
          userType: user.userType,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.handler = (user as { handler?: string }).handler
        token.userType = (user as { userType?: string }).userType
      }

      // Handle impersonation updates from client
      if (trigger === 'update' && session) {
        if (session.impersonating) {
          token.impersonatingId = session.impersonating.id
          token.impersonatingName = session.impersonating.name
          token.impersonatingHandler = session.impersonating.handler
        } else if (session.impersonating === null) {
          delete token.impersonatingId
          delete token.impersonatingName
          delete token.impersonatingHandler
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.handler = token.handler as string
        session.user.userType = token.userType as string
      }

      // Add impersonation data to session if present
      if (token.impersonatingId) {
        session.impersonating = {
          id: token.impersonatingId as string,
          name: token.impersonatingName as string,
          handler: token.impersonatingHandler as string,
        }
      }

      return session
    },
  },
  pages: {
    signIn: '/',
  },
  session: {
    strategy: 'jwt',
  },
})

