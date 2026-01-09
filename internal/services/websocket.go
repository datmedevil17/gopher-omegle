package services

import (
	"encoding/json"
	"log"
	"strconv"
	"sync"

	"github.com/gorilla/websocket"
)

type Client struct {
	ID     string
	Conn   *websocket.Conn
	UserID uint
	Name   string
	RoomID string
	Send   chan []byte
	Hub    *Hub
}

type Hub struct {
	Clients     map[string]*Client
	Queue       []string
	Rooms       map[string]*Room
	Register    chan *Client
	Unregister  chan *Client
	Broadcast   chan *Message
	RoomManager *RoomManager
	mu          sync.RWMutex
}

type Room struct {
	ID    string
	User1 *Client
	User2 *Client
}

type Message struct {
	Type      string          `json:"type"`
	RoomID    string          `json:"roomId,omitempty"`
	SDP       string          `json:"sdp,omitempty"`
	Candidate json.RawMessage `json:"candidate,omitempty"`
	CandType  string          `json:"candType,omitempty"`
	From      string          `json:"from,omitempty"`
	Text      string          `json:"text,omitempty"`
}

func NewHub() *Hub {
	return &Hub{
		Clients:     make(map[string]*Client),
		Queue:       make([]string, 0),
		Rooms:       make(map[string]*Room),
		Register:    make(chan *Client),
		Unregister:  make(chan *Client),
		Broadcast:   make(chan *Message),
		RoomManager: NewRoomManager(),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			h.Clients[client.ID] = client
			h.Queue = append(h.Queue, client.ID)
			log.Printf("Client registered: %s, Queue size: %d", client.ID, len(h.Queue))
			h.mu.Unlock()

			// Send lobby message
			lobbyMsg, _ := json.Marshal(Message{Type: "lobby"})
			client.Send <- lobbyMsg

			// Try to match users
			h.MatchUsers()

		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.Clients[client.ID]; ok {
				delete(h.Clients, client.ID)
				close(client.Send)
				h.RemoveFromQueue(client.ID)
				h.HandleDisconnect(client)
				log.Printf("Client unregistered: %s", client.ID)
			}
			h.mu.Unlock()

		case message := <-h.Broadcast:
			h.HandleMessage(message)
		}
	}
}

func (h *Hub) MatchUsers() {
	h.mu.Lock()
	defer h.mu.Unlock()

	if len(h.Queue) < 2 {
		return
	}

	user1ID := h.Queue[0]
	user2ID := h.Queue[1]

	user1, ok1 := h.Clients[user1ID]
	user2, ok2 := h.Clients[user2ID]

	// Check if clients exist
	if !ok1 || !ok2 {
		log.Printf("Match failed: one or both users not found (U1: %v, U2: %v)", ok1, ok2)
		// Clean up invalid IDs from queue
		if !ok1 {
			h.RemoveFromQueue(user1ID)
		}
		if !ok2 {
			h.RemoveFromQueue(user2ID)
		}
		return
	}

	// Remove from queue
	h.Queue = h.Queue[2:]

	// Create room
	roomID := h.RoomManager.CreateRoom()
	room := &Room{
		ID:    roomID,
		User1: user1,
		User2: user2,
	}

	h.Rooms[roomID] = room
	user1.RoomID = roomID
	user2.RoomID = roomID

	log.Printf("Matched users: %s (Initiator) and %s (Peer) in Room %s", user1ID, user2ID, roomID)

	// Send 'send-offer' to Initiator (User 1)
	offerMsg, _ := json.Marshal(Message{
		Type:   "send-offer",
		RoomID: roomID,
	})

	select {
	case user1.Send <- offerMsg:
		log.Printf("Sent send-offer to Initiator %s", user1ID)
	default:
		log.Printf("Failed to send to Initiator %s: buffer full", user1ID)
	}

	// Send 'match-found' to Peer (User 2)
	matchMsg, _ := json.Marshal(Message{
		Type:   "match-found",
		RoomID: roomID,
	})

	select {
	case user2.Send <- matchMsg:
		log.Printf("Sent match-found to Peer %s", user2ID)
	default:
		log.Printf("Failed to send to Peer %s: buffer full", user2ID)
	}
}

func (h *Hub) HandleMessage(msg *Message) {
	h.mu.RLock()
	room, exists := h.Rooms[msg.RoomID]
	h.mu.RUnlock()

	if !exists {
		log.Printf("Room %s not found", msg.RoomID)
		return
	}

	var recipient *Client
	if room.User1.ID == msg.From {
		recipient = room.User2
	} else {
		recipient = room.User1
	}

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}

	select {
	case recipient.Send <- data:
		log.Printf("Message sent to %s in room %s", recipient.ID, msg.RoomID)
	default:
		log.Printf("Failed to send message to %s", recipient.ID)
	}
}

func (h *Hub) RemoveFromQueue(clientID string) {
	for i, id := range h.Queue {
		if id == clientID {
			h.Queue = append(h.Queue[:i], h.Queue[i+1:]...)
			break
		}
	}
}

func (h *Hub) HandleDisconnect(client *Client) {
	if client.RoomID != "" {
		if room, exists := h.Rooms[client.RoomID]; exists {
			var other *Client
			if room.User1.ID == client.ID {
				other = room.User2
			} else {
				other = room.User1
			}

			// Notify other user
			if other != nil {
				disconnectMsg, _ := json.Marshal(Message{
					Type: "user-disconnected",
				})
				select {
				case other.Send <- disconnectMsg:
				default:
				}
			}

			delete(h.Rooms, client.RoomID)
		}
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			log.Printf("Error reading message: %v", err)
			break
		}

		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Error unmarshaling message: %v", err)
			continue
		}

		msg.From = c.ID

		switch msg.Type {
		case "offer", "answer", "add-ice-candidate", "chat", "typing":
			c.Hub.Broadcast <- &msg
		default:
			log.Printf("Unknown message type: %s", msg.Type)
		}
	}
}

func (c *Client) WritePump() {
	defer c.Conn.Close()

	for message := range c.Send {
		if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
			log.Printf("Error writing message: %v", err)
			break
		}
	}
}

type RoomManager struct {
	counter int
	mu      sync.Mutex
}

func NewRoomManager() *RoomManager {
	return &RoomManager{counter: 0}
}

func (rm *RoomManager) CreateRoom() string {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	rm.counter++
	return strconv.Itoa(rm.counter)
}
