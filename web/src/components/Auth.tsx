import { useState } from 'react'
import { request } from '../lib/api'
import { useAuthStore } from '../store'
import { LogIn, UserPlus } from 'lucide-react'

export function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const setAuth = useAuthStore((state) => state.setAuth)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register'
      const data = await request(endpoint, {
        method: 'POST',
        body: JSON.stringify(formData),
      })

      setAuth(data.data.user, data.data.token)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700">
        <h2 className="text-3xl font-bold text-center mb-8 text-white">
          {isLogin ? 'Welcome Back' : 'Join GopherOmegle'}
        </h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
              <input
                type="text"
                required
                className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white focus:border-blue-500 focus:outline-none"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white focus:border-blue-500 focus:outline-none"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white focus:border-blue-500 focus:outline-none"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => {
              setIsLogin(!isLogin)
              setError('')
              setFormData({ name: '', email: '', password: '' })
            }}
            className="text-blue-500 hover:underline bg-transparent p-0 border-none"
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  )
}
