'use client'

import { AuthGuard } from './components/auth/AuthGuard'

export default function Home() {
  return <AuthGuard />
}
