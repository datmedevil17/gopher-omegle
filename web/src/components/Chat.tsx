import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store'
import { Video, VideoOff, Mic, MicOff, MessageSquare, Send, Smile } from 'lucide-react'
import EmojiPicker from 'emoji-picker-react'

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
  const [isStrangerTyping, setIsStrangerTyping] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  
  const wsRef = useRef<WebSocket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const roomRef = useRef<string>('')
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<number | null>(null)
  const lastTypingSentRef = useRef<number>(0)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isStrangerTyping])

  // Exit warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (status === 'connected') {
        e.preventDefault()
        e.returnValue = '' // Chrome requires this
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [status])

  useEffect(() => {
    // Setup local video
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
      })
      .catch(err => console.error("Media access error:", err)) 
      
    return () => {
       if (localVideoRef.current && localVideoRef.current.srcObject) {
         const stream = localVideoRef.current.srcObject as MediaStream
         stream.getTracks().forEach(track => track.stop())
       }
    }
  }, [])

  const startSearching = () => {
    setStatus('searching')
    setMessages([])
    setIsStrangerTyping(false)
    setRemoteStream(null)
    roomRef.current = ''
    
    // Connect WS
    const ws = new WebSocket(`ws://localhost:8080/ws?token=${token}`)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('Connected to WS')
    }

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data)
      // console.log('WS Message:', msg) // verbose

      switch (msg.type) {
        case 'lobby':
          break
        
        case 'match-found':
          setStatus('connected')
          roomRef.current = msg.roomId
          break
        
        case 'send-offer':
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
           setIsStrangerTyping(false) // Stop typing indicator if they sent message
           setMessages(prev => [...prev, { sender: 'stranger', text: msg.text }])
           break

        case 'typing':
           setIsStrangerTyping(true)
           if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current)
           typingTimeoutRef.current = window.setTimeout(() => setIsStrangerTyping(false), 2000)
           break

        case 'user-disconnected':
           setStatus('idle')
           setMessages(prev => [...prev, { sender: 'stranger', text: 'Stranger disconnected.' }])
           setIsStrangerTyping(false)
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
      const stream = event.streams[0]
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream
      }
      setRemoteStream(stream)
    }

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
    setRemoteStream(null)
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     setInputText(e.target.value)
     
     // Send typing status throttled
     const now = Date.now()
     if (now - lastTypingSentRef.current > 1000 && wsRef.current && status === 'connected') {
        wsRef.current.send(JSON.stringify({
           type: 'typing',
           roomId: roomRef.current
        }))
        lastTypingSentRef.current = now
     }
  }

  const sendMessage = () => {
     if (inputText.trim() && wsRef.current && status === 'connected') {
        wsRef.current.send(JSON.stringify({
           type: 'chat',
           roomId: roomRef.current,
           text: inputText
        }))
        setMessages(prev => [...prev, { sender: 'me', text: inputText }])
        setInputText('')
     }
  }

  return (
     <div className="flex h-screen bg-white flex-col md:flex-row">
        {/* Sidebar / Chat Area */}
        <div className="w-full md:w-1/4 h-[35vh] md:h-full bg-gray-50 border-t md:border-t-0 md:border-r border-gray-200 flex flex-col order-2 md:order-1">
           <div className="p-3 md:p-4 border-b border-gray-200 flex items-center gap-2">
             <MessageSquare className="text-black w-5 h-5 md:w-6 md:h-6" />
             <div className="flex-1 min-w-0">
               <h1 className="text-lg md:text-xl font-bold text-gray-900 tracking-tight truncate">GopherOmegle</h1>
               <p className="text-xs md:text-sm text-gray-500 truncate">Logged in as {user?.name}</p>
             </div>
             <button onClick={logout} className="ml-auto text-xs text-red-500 hover:text-red-600 font-medium whitespace-nowrap">Logout</button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`p-2 md:p-3 rounded-lg max-w-[85%] break-words shadow-sm text-sm ${m.sender === 'me' ? 'bg-black text-white ml-auto' : 'bg-white border border-gray-200 text-gray-800'}`}>
                  {m.text}
                </div>
              ))}
              
              {isStrangerTyping && (
                 <div className="text-gray-500 text-xs italic ml-2">Stranger is typing...</div>
              )}

              {status === 'searching' && <div className="text-gray-600 italic animate-pulse flex items-center gap-2 text-xs md:text-base"><div className="w-2 h-2 bg-yellow-400 rounded-full"/> Searching...</div>}
              {status === 'idle' && <div className="text-gray-500 italic flex items-center gap-2 text-xs md:text-sm"><div className="w-2 h-2 bg-gray-400 rounded-full"/> Check your hair, then start.</div>}
              {status === 'connected' && <div className="text-gray-800 font-medium italic flex items-center gap-2 text-xs md:text-sm"><div className="w-2 h-2 bg-green-500 rounded-full"/> Connected</div>}
              
              {/* Ref for auto-scroll */}
              <div ref={messagesEndRef} />
           </div>

           <div className="p-3 md:p-4 border-t border-gray-200 flex gap-2 bg-white relative">
              {showEmojiPicker && (
                  <div className="absolute bottom-full left-4 mb-2 z-50 shadow-xl rounded-lg">
                      <EmojiPicker onEmojiClick={(emojiData: EmojiClickData) => {
                          setInputText(prev => prev + emojiData.emoji)
                          // setShowEmojiPicker(false) // Keep open for multi-select
                      }} />
                  </div>
              )}
              
              <button 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Smile size={24} />
              </button>

              <input 
                className="flex-1 bg-gray-50 border border-gray-300 rounded-lg p-2 md:p-3 text-sm md:text-base text-gray-900 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all" 
                placeholder="Type a message..."
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                      sendMessage()
                      setShowEmojiPicker(false)
                  }
                }}
                disabled={status !== 'connected'}
                onClick={() => setShowEmojiPicker(false)} // Close when typing
              />
              <button 
                onClick={sendMessage}
                disabled={status !== 'connected'}
                className="bg-black p-2 md:p-3 rounded-lg text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={20}/>
              </button>
           </div>
        </div>

        {/* Video Area */}
        <div className="w-full md:flex-1 h-[65vh] md:h-full flex flex-col p-4 md:p-6 gap-4 md:gap-6 relative bg-gray-100 justify-center items-center order-1 md:order-2">
             
             {/* Main Video Container (Remote) */}
             <div className="absolute inset-2 md:inset-4 rounded-xl md:rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-200 flex items-center justify-center">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                {!remoteStream && status === 'connected' && (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                        <div className="w-8 h-8 md:w-12 md:h-12 border-2 border-gray-300 border-t-black rounded-full animate-spin"/>
                        <span className="text-sm md:text-base">Waiting for video...</span>
                    </div>
                )}
                {status !== 'connected' && (
                   <div className="text-gray-300 text-4xl md:text-6xl opacity-20 font-bold select-none tracking-tighter">
                      GOPHER
                   </div>
                )}
                
                {status === 'connected' && (
                  <div className="absolute top-4 left-4 md:top-6 md:left-6 bg-white/90 backdrop-blur border border-gray-200 px-2 py-1 md:px-3 md:py-1.5 rounded-full text-gray-900 text-xs md:text-sm font-medium flex items-center gap-2 shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-green-500 box-content border-2 border-white" />
                    Stranger
                  </div>
                )}
             </div>

             {/* Local Video - Transitioning 'Hair Screen' */}
             <div className={`
                 overflow-hidden bg-gray-900 shadow-2xl border-2 md:border-4 border-white transition-all duration-700 ease-in-out z-20
                 ${status === 'idle' 
                    ? 'relative w-full h-full md:w-[640px] md:h-[480px] rounded-xl md:rounded-2xl' // Hair Screen Mode
                    : 'absolute bottom-4 right-4 w-28 h-20 md:bottom-8 md:right-8 md:w-64 md:h-48 rounded-lg md:rounded-xl' // PiP Mode
                  }
             `}
             >
                <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover transform scale-x-[-1] ${!isVideoEnabled ? 'hidden' : ''}`} />
                {!isVideoEnabled && <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-800 text-xs md:text-base">Camera Off</div>}
                
                {/* Controls - Always visible on Hair Screen, Hover on PiP */}
                <div className={`
                    absolute bottom-0 left-0 right-0 p-2 md:p-4 bg-gradient-to-t from-black/80 to-transparent flex justify-center gap-4
                    ${status === 'idle' ? 'opacity-100' : 'opacity-0 hover:opacity-100 transition-opacity'}
                `}>
                   <button onClick={toggleAudio} className={`p-2 md:p-3 rounded-full shadow-lg transition-transform hover:scale-105 ${isAudioEnabled ? 'bg-white text-black hover:bg-gray-200' : 'bg-red-500 text-white hover:bg-red-600'}`}>
                      {isAudioEnabled ? <Mic size={16} className="md:w-5 md:h-5" /> : <MicOff size={16} className="md:w-5 md:h-5" />}
                   </button>
                   <button onClick={toggleVideo} className={`p-2 md:p-3 rounded-full shadow-lg transition-transform hover:scale-105 ${isVideoEnabled ? 'bg-white text-black hover:bg-gray-200' : 'bg-red-500 text-white hover:bg-red-600'}`}>
                      {isVideoEnabled ? <Video size={16} className="md:w-5 md:h-5" /> : <VideoOff size={16} className="md:w-5 md:h-5" />}
                   </button>
                </div>
                
                <div className="absolute top-2 left-2 md:top-4 md:left-4 bg-black/50 backdrop-blur px-1.5 py-0.5 md:px-2 md:py-1 rounded-md text-white text-[10px] md:text-xs font-medium">You</div>
             </div>

             {/* Action Buttons (Start/Stop) */}
             <div className={`absolute left-1/2 -translate-x-1/2 transition-all duration-500 ${status === 'idle' ? 'bottom-16 md:bottom-24 scale-100 md:scale-110' : 'bottom-4 md:bottom-8 scale-90 md:scale-100'}`}>
                {status === 'idle' ? (
                   <button onClick={startSearching} className="bg-black hover:bg-gray-800 text-white font-bold py-3 px-8 md:py-4 md:px-12 rounded-full shadow-xl transform transition hover:scale-105 hover:shadow-2xl flex items-center gap-2 md:gap-3 text-base md:text-lg whitespace-nowrap">
                     Start Chat
                   </button>
                ) : (
                   <button onClick={() => {
                     setStatus('idle')
                     wsRef.current?.close()
                     closePeerConnection()
                   }} className="bg-white hover:bg-gray-50 text-red-600 border border-gray-200 font-bold py-2 px-6 md:py-3 md:px-8 rounded-full shadow-lg z-30 relative text-sm md:text-base whitespace-nowrap">
                     Stop Chat
                   </button>
                )}
             </div>
        </div>
     </div>
  )
}

