import { useState, useCallback } from 'react'
import api from '../api/client'

export function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem('token'))

  const login = useCallback(async (username, password) => {
    const form = new URLSearchParams()
    form.append('username', username)
    form.append('password', password)
    const { data } = await api.post('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    localStorage.setItem('token', data.access_token)
    setToken(data.access_token)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
    window.location.href = '/login'
  }, [])

  return { token, login, logout }
}
