import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store'
import { Video, VideoOff, Mic, MicOff, MessageSquare, Send } from 'lucide-react'

// WebRTC Configuration
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
}

export function Chat() {
  const { token, user, logout } = useAuthStore()
  const [status, setStatus] = useState('idle') // idle, searching, connected
  const [messages, setMessages] = useState<{ sender: 'me' | 'stranger'; text: string }[]>([])
  const [inputText, setInputText] = useState('')
  
  const wsRef = useRef<WebSocket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const roomRef = useRef<string>('')
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    // Setup local video
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
      })
      .catch(err => console.error("Media access error:", err)) 
      
    return () => {
       // Cleanup tracks if needed
       if (localVideoRef.current && localVideoRef.current.srcObject) {
         const stream = localVideoRef.current.srcObject as MediaStream
         stream.getTracks().forEach(track => track.stop())
       }
    }
  }, [])

  const startSearching = () => {
    setStatus('searching')
    setMessages([])
    roomRef.current = ''
    
    // Connect WS
    const ws = new WebSocket(`ws://localhost:8080/ws?token=${token}`)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('Connected to WS')
    }

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data)
      console.log('WS Message:', msg)

      switch (msg.type) {
        case 'lobby':
          break

        case 'match-found':
          setStatus('connected')
          roomRef.current = msg.roomId
          break
        
        case 'send-offer':
          // Match found! I am the initiator
          setStatus('connected')
          roomRef.current = msg.roomId
          createPeerConnection()
          const offer = await pcRef.current?.createOffer()
          await pcRef.current?.setLocalDescription(offer)
          ws.send(JSON.stringify({
             type: 'offer',
             roomId: msg.roomId,
             sdp: JSON.stringify(offer)
          }))
          break
        
        case 'offer':
           // I am the receiver
           setStatus('connected')
           roomRef.current = msg.roomId
           createPeerConnection()
           const offerDesc = JSON.parse(msg.sdp)
           await pcRef.current?.setRemoteDescription(offerDesc)
           const answer = await pcRef.current?.createAnswer()
           await pcRef.current?.setLocalDescription(answer)
           ws.send(JSON.stringify({
             type: 'answer',
             roomId: msg.roomId,
             sdp: JSON.stringify(answer)
           }))
           break

        case 'answer':
           const answerDesc = JSON.parse(msg.sdp)
           await pcRef.current?.setRemoteDescription(answerDesc)
           break

        case 'add-ice-candidate':
           if (msg.candidate) {
             await pcRef.current?.addIceCandidate(msg.candidate)
           }
           break
        
        case 'chat':
           setMessages(prev => [...prev, { sender: 'stranger', text: msg.text }])
           break

        case 'user-disconnected':
           setStatus('idle')
           setMessages(prev => [...prev, { sender: 'stranger', text: 'Stranger disconnected.' }])
           closePeerConnection()
           ws.close()
           break
      }
    }
  }

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(rtcConfig)
    pcRef.current = pc

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'add-ice-candidate',
          roomId: roomRef.current,
          candidate: event.candidate
        }))
      }
    }

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0]
      }
    }

    // Add local tracks
    if (localVideoRef.current && localVideoRef.current.srcObject) {
       const stream = localVideoRef.current.srcObject as MediaStream
       stream.getTracks().forEach(track => pc.addTrack(track, stream))
    }
  }

  const closePeerConnection = () => {
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }
  }

  // Media controls
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)

  const toggleAudio = () => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream
      stream.getAudioTracks().forEach(track => track.enabled = !isAudioEnabled)
      setIsAudioEnabled(!isAudioEnabled)
    }
  }

  const toggleVideo = () => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream
      stream.getVideoTracks().forEach(track => track.enabled = !isVideoEnabled)
      setIsVideoEnabled(!isVideoEnabled)
    }
  }

  return (
     <div className="flex h-screen bg-gray-900 overflow-hidden">
        {/* Sidebar / Chat Area */}
        <div className="w-1/4 bg-gray-800 border-r border-gray-700 flex flex-col">
           <div className="p-4 border-b border-gray-700 flex items-center gap-2">
             <MessageSquare className="text-blue-500" />
             <div>
               <h1 className="text-xl font-bold text-white">GopherOmegle</h1>
               <p className="text-sm text-gray-400">Logged in as {user?.name}</p>
             </div>
             <button onClick={logout} className="ml-auto text-xs text-red-400 hover:text-red-300">Logout</button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`p-2 rounded max-w-[80%] ${m.sender === 'me' ? 'bg-blue-600 ml-auto' : 'bg-gray-700'}`}>
                  {m.text}
                </div>
              ))}
              {status === 'searching' && <div className="text-yellow-500 italic animate-pulse">Searching for a stranger...</div>}
              {status === 'idle' && <div className="text-gray-500 italic flex items-center gap-2"><div className="w-2 h-2 bg-gray-500 rounded-full"/> Ready to connect.</div>}
              {status === 'connected' && <div className="text-green-500 italic flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full"/> Connected!</div>}
           </div>

           <div className="p-4 border-t border-gray-700 flex gap-2">
              <input 
                className="flex-1 bg-gray-700 border border-gray-600 rounded p-2 text-white focus:outline-none focus:border-blue-500" 
                placeholder="Type a message..."
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && inputText.trim()) {
                    if (wsRef.current && status === 'connected') {
                       wsRef.current.send(JSON.stringify({
                         type: 'chat',
                         roomId: roomRef.current,
                         text: inputText
                       }))
                       setMessages(prev => [...prev, { sender: 'me', text: inputText }])
                       setInputText('')
                    }
                  }
                }}
              />
              <button 
                onClick={() => {
                    if (inputText.trim() && wsRef.current && status === 'connected') {
                       wsRef.current.send(JSON.stringify({
                         type: 'chat',
                         roomId: roomRef.current,
                         text: inputText
                       }))
                       setMessages(prev => [...prev, { sender: 'me', text: inputText }])
                       setInputText('')
                    }
                }}
                className="bg-blue-600 p-2 rounded text-white hover:bg-blue-700"
              >
                <Send size={20}/>
              </button>
           </div>
        </div>

        {/* Video Area */}
        <div className="flex-1 flex flex-col p-4 gap-4 relative">
             <div className="flex-1 bg-black rounded-lg overflow-hidden relative flex items-center justify-center">
                {/* Remote Video */}
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                {!remoteVideoRef.current?.srcObject && status === 'connected' && <div className="text-gray-500">Waiting for video...</div>}
                {status !== 'connected' && <div className="text-gray-700">Stranger's video will appear here</div>}
                <div className="absolute top-4 left-4 bg-black/50 px-2 py-1 rounded text-white text-sm flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-gray-500'}`} />
                  Stranger
                </div>
             </div>

             <div className="h-48 w-64 bg-black rounded-lg absolute bottom-8 right-8 shadow-2xl border border-gray-700 overflow-hidden group">
                {/* Local Video */}
                <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${!isVideoEnabled ? 'hidden' : ''}`} />
                {!isVideoEnabled && <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-900">Camera Off</div>}
                
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-center gap-4">
                   <button onClick={toggleAudio} className={`p-2 rounded-full ${isAudioEnabled ? 'bg-gray-600 hover:bg-gray-500' : 'bg-red-500 hover:bg-red-600'}`}>
                      {isAudioEnabled ? <Mic size={16} /> : <MicOff size={16} />}
                   </button>
                   <button onClick={toggleVideo} className={`p-2 rounded-full ${isVideoEnabled ? 'bg-gray-600 hover:bg-gray-500' : 'bg-red-500 hover:bg-red-600'}`}>
                      {isVideoEnabled ? <Video size={16} /> : <VideoOff size={16} />}
                   </button>
                </div>
                
                <div className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-xs">You</div>
             </div>

             <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
                {status === 'idle' ? (
                   <button onClick={startSearching} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-8 rounded-full shadow-lg transform transition hover:scale-105">
                     Start Chat
                   </button>
                ) : (
                   <button onClick={() => {
                     setStatus('idle')
                     wsRef.current?.close()
                     closePeerConnection()
                   }} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-full shadow-lg">
                     Stop
                   </button>
                )}
             </div>
        </div>
     </div>
  )
}
