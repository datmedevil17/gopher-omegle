export const API_URL = 'http://localhost:8080/api/v1'

export async function request(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token')
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong')
  }

  return data
}
