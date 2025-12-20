import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email?: string | null
      name?: string | null
      handler?: string
      userType?: string
    }
  }

  interface User {
    handler?: string
    userType?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    handler?: string
    userType?: string
  }
}
