import { Auth } from './components/Auth'
import { Chat } from './components/Chat'
import { useAuthStore } from './store'

function App() {
  const token = useAuthStore((state) => state.token)

  if (!token) {
    return <Auth />
  }

  return <Chat />
}

export default App
