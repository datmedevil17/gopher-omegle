package config

import (
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Database DatabaseConfig
	JWT      JWTConfig
	Server   ServerConfig
}

type DatabaseConfig struct {
	Host     string
	User     string
	Password string
	DBName   string
	Port     string
	SSLMode  string
}

type JWTConfig struct {
	Secret string
	Expiry time.Duration
}

type ServerConfig struct {
	Port           string
	AllowedOrigins []string
	LogLevel       string
}

func Load() *Config {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Parse JWT expiry
	jwtExpiry, err := time.ParseDuration(getEnv("JWT_EXPIRY", "24h"))
	if err != nil {
		jwtExpiry = 24 * time.Hour
	}

	return &Config{
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", "postgres"),
			DBName:   getEnv("DB_NAME", "webrtc_db"),
			Port:     getEnv("DB_PORT", "5432"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		JWT: JWTConfig{
			Secret: getEnv("JWT_SECRET", "your-secret-key"),
			Expiry: jwtExpiry,
		},
		Server: ServerConfig{
			Port:           getEnv("SERVER_PORT", "8080"),
			AllowedOrigins: []string{getEnv("ALLOWED_ORIGINS", "http://localhost:3000")},
			LogLevel:       getEnv("LOG_LEVEL", "debug"),
		},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}