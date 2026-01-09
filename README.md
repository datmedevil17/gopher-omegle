# GopherOmegle

**GopherOmegle** is a high-performance, open-source 1:1 video chat application inspired by the classic Omegle platform. Built with modern technologies, simplify real-time communication with a robust Go backend and a sleek React frontend.

## 🏗️ Architecture

The system follows a client-server architecture with peer-to-peer (P2P) WebRTC connections for media streaming.

```mermaid
graph TD
    User[User Client] -->|HTTPS/WSS| LB[Load Balancer / Nginx]
    LB -->|HTTPS| Frontend[Frontend (React + Vite)]
    LB -->|API / WS| Backend[Backend API (Go + Gin)]

    subgraph "Backend Services"
        Backend -->|Auth| JWT[JWT Auth Middleware]
        Backend -->|Persist| DB[(PostgreSQL)]
        Backend -->|Real-time| Hub[WebSocket Hub]
    end

    subgraph "P2P Media Stream"
        User -- "Video/Audio (WebRTC)" --> Peer[Peer User]
        User -. "Signaling (SDP/ICE)" .-> Hub
        Peer -. "Signaling (SDP/ICE)" .-> Hub
    end
```

### Flow
1.  **Authentication**: Users login/register via REST API to receive a JWT.
2.  **Connection**: Client connects to WebSocket with the JWT.
3.  **Matchmaking**: Backend places user in a queue. When 2 users are available, a Room is created.
4.  **Signaling**: Backend facilitates the exchange of SDP offers/answers and ICE candidates via WebSocket.
5.  **Streaming**: Once signaled, clients establish a direct P2P WebRTC connection for low-latency video and audio.

---

## 🛠️ Tech Stack

### Backend
*   **Language**: Go (Golang)
*   **Framework**: Gin Web Framework
*   **Real-time**: Gorilla WebSocket
*   **Database**: PostgreSQL
*   **ORM**: GORM
*   **Auth**: JWT (JSON Web Tokens)

### Frontend
*   **Framework**: React 19
*   **Build Tool**: Vite
*   **Styling**: Tailwind CSS v4
*   **State Management**: Zustand
*   **WebRTC**: Native Browser API
*   **Icons**: Lucide React

---

## ✨ Key Features

*   **Professional UI**: sleek, responsive design with a "Hair Screen" lobby for checking your camera before joining.
*   **Real-time Matching**: Efficient queue-based matchmaking system.
*   **P2P Video/Audio**: High-quality, low-latency communication directly between users.
*   **Secure**: JWT-based authentication and secure WebSocket connections.
*   **User Experience**: "Stranger is typing..." indicators, chat auto-scroll, and accidental exit protection.
*   **Interactive**: Emoji picker support for chat.

---

## 🚀 Getting Started

### Prerequisites
*   Go 1.22+
*   Node.js & Bun (or npm)
*   PostgreSQL
*   Docker (Optional)

### Running Locally

1.  **Database**: Ensure PostgreSQL is running and update `.env` with credentials.
2.  **Backend**:
    ```bash
    go run cmd/api/main.go
    ```
3.  **Frontend**:
    ```bash
    cd web
    bun install
    bun dev
    ```

Access the app at `http://localhost:5173`.
