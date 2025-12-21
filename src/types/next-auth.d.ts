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
    impersonating?: {
      id: string
      name: string
      handler: string
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
    impersonatingId?: string
    impersonatingName?: string
    impersonatingHandler?: string
  }
}
