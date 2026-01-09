package user

import (
	"net/http"
	"github.com/datmedevil17/gopher-omegle/internal/config"
	"github.com/datmedevil17/gopher-omegle/internal/services"
	"github.com/datmedevil17/gopher-omegle/internal/utils"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	userService *services.UserService
	config      *config.Config
}

func NewHandler(config *config.Config) *Handler {
	return &Handler{
		userService: services.NewUserService(),
		config:      config,
	}
}

func (h *Handler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	user, err := h.userService.Register(req.Name, req.Email, req.Password)
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	token, err := utils.GenerateToken(user.ID, user.Email, &h.config.JWT)
	if err != nil {
		utils.ErrorResponse(c, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	utils.SuccessResponse(c, http.StatusCreated, "User registered successfully", LoginResponse{
		Token: token,
		User:  user.ToResponse(),
	})
}

func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	user, err := h.userService.Login(req.Email, req.Password)
	if err != nil {
		utils.ErrorResponse(c, http.StatusUnauthorized, err.Error())
		return
	}

	token, err := utils.GenerateToken(user.ID, user.Email, &h.config.JWT)
	if err != nil {
		utils.ErrorResponse(c, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "Login successful", LoginResponse{
		Token: token,
		User:  user.ToResponse(),
	})
}

func (h *Handler) GetProfile(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		utils.ErrorResponse(c, http.StatusUnauthorized, "User not authenticated")
		return
	}

	user, err := h.userService.GetByID(userID.(uint))
	if err != nil {
		utils.ErrorResponse(c, http.StatusNotFound, "User not found")
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "Profile retrieved successfully", user.ToResponse())
}