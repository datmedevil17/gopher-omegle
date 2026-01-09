package middleware

import (
	"net/http"
	"strings"
	"github.com/datmedevil17/gopher-omegle/internal/config"
	"github.com/datmedevil17/gopher-omegle/internal/utils"

	"github.com/gin-gonic/gin"
)

func AuthMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			utils.ErrorResponse(c, http.StatusUnauthorized, "Authorization header required")
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			utils.ErrorResponse(c, http.StatusUnauthorized, "Invalid authorization header format")
			c.Abort()
			return
		}

		claims, err := utils.ValidateToken(parts[1], &cfg.JWT)
		if err != nil {
			utils.ErrorResponse(c, http.StatusUnauthorized, "Invalid or expired token")
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("email", claims.Email)
		c.Next()
	}
}