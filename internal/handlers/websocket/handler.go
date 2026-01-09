package websocket

import (
	"crypto/rand"
	"encoding/base64"
	"log"
	"net/http"
	"time"

	"github.com/datmedevil17/gopher-omegle/internal/config"
	"github.com/datmedevil17/gopher-omegle/internal/services"
	"github.com/datmedevil17/gopher-omegle/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

type Handler struct {
	hub    *services.Hub
	config *config.Config
}

func NewHandler(hub *services.Hub, config *config.Config) *Handler {
	return &Handler{
		hub:    hub,
		config: config,
	}
}

func (h *Handler) HandleWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}

	// Authenticate
	token := c.Query("token")
	var name string

	if token != "" {
		claims, err := utils.ValidateToken(token, &h.config.JWT)
		if err != nil {
			// Invalid token
			log.Printf("Invalid token: %v", err)
			conn.WriteMessage(websocket.CloseMessage, []byte{})
			conn.Close()
			return
		}
		name = claims.Email
	} else {
		// Anonymous fallback
		name = "Anonymous"
	}

	// Allow overriding name for Anonymous if needed, or strictly enforce token?
	// The requirement is "lobby should use the registered user name when the user logged in".
	// If they didn't log in (Anonymous), we keep it as Anonymous.
	if name == "Anonymous" && c.Query("name") != "" {
		name = c.Query("name")
	}

	// Create client
	client := &services.Client{
		ID:   generateClientID(),
		Conn: conn,
		Name: name,
		Send: make(chan []byte, 256),
		Hub:  h.hub,
	}

	// Register client
	h.hub.Register <- client

	// Start goroutines
	go client.WritePump()
	go client.ReadPump()
}

func generateClientID() string {
	b := make([]byte, 16)
	_, err := rand.Read(b)
	if err != nil {
		return "fallback-" + time.Now().String()
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
