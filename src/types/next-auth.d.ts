import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email?: string | null
      name?: string | null
      handler?: string
      userType?: string
      mustChangePassword?: boolean
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
    mustChangePassword?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    handler?: string
    userType?: string
    mustChangePassword?: boolean
    impersonatingId?: string
    impersonatingName?: string
    impersonatingHandler?: string
  }
}
