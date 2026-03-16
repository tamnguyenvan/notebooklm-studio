'use client'

import { useEffect } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { LoginScreen } from './LoginScreen'
import { AppShell } from '../layout/AppShell'

/**
 * AuthGuard — checks auth status on mount, then renders either
 * the LoginScreen or the AppShell depending on login state.
 */
export function AuthGuard() {
  const { isLoggedIn, checkStatus } = useAuthStore()

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  if (!isLoggedIn) {
    return <LoginScreen />
  }

  return <AppShell />
}
