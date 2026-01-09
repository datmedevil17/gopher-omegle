package main

import (
	"log"
	"os"

	"github.com/datmedevil17/gopher-omegle/internal/config"
	"github.com/datmedevil17/gopher-omegle/internal/database"
	userHandler "github.com/datmedevil17/gopher-omegle/internal/handlers/user"
	wsHandler "github.com/datmedevil17/gopher-omegle/internal/handlers/websocket"
	"github.com/datmedevil17/gopher-omegle/internal/middleware"
	"github.com/datmedevil17/gopher-omegle/internal/services"

	"github.com/gin-gonic/gin"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Connect to database
	if err := database.Connect(&cfg.Database); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Run migrations
	if len(os.Args) > 1 && os.Args[1] == "migrate" {
		if err := database.Migrate(); err != nil {
			log.Fatalf("Failed to run migrations: %v", err)
		}
		log.Println("Migrations completed successfully")
		return
	}

	// Auto migrate on startup
	if err := database.Migrate(); err != nil {
		log.Printf("Warning: Failed to run migrations: %v", err)
	}

	// Initialize WebSocket hub
	hub := services.NewHub()
	go hub.Run()

	// Setup Gin router
	router := setupRouter(cfg, hub)

	// Start server
	log.Printf("Server starting on port %s", cfg.Server.Port)
	if err := router.Run(":" + cfg.Server.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func setupRouter(cfg *config.Config, hub *services.Hub) *gin.Engine {
	// Set Gin mode
	if cfg.Server.LogLevel == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// Middleware
	router.Use(middleware.CORSMiddleware())

	// Initialize handlers
	userH := userHandler.NewHandler(cfg)
	wsH := wsHandler.NewHandler(hub, cfg)

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"message": "Server is running",
		})
	})

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Public routes
		auth := v1.Group("/auth")
		{
			auth.POST("/register", userH.Register)
			auth.POST("/login", userH.Login)
		}

		// Protected routes
		protected := v1.Group("/")
		protected.Use(middleware.AuthMiddleware(cfg))
		{
			protected.GET("/profile", userH.GetProfile)
		}
	}

	// WebSocket route
	router.GET("/ws", wsH.HandleWebSocket)

	return router
}
