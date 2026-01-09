package services

import (
	"errors"
	"github.com/datmedevil17/gopher-omegle/internal/database"
	"github.com/datmedevil17/gopher-omegle/internal/models"
	"github.com/datmedevil17/gopher-omegle/internal/utils"
)

type UserService struct{}

func NewUserService() *UserService {
	return &UserService{}
}

func (s *UserService) Register(name, email, password string) (*models.User, error) {
	// Check if user already exists
	var existingUser models.User
	if err := database.DB.Where("email = ?", email).First(&existingUser).Error; err == nil {
		return nil, errors.New("user with this email already exists")
	}

	// Hash password
	hashedPassword, err := utils.HashPassword(password)
	if err != nil {
		return nil, err
	}

	// Create user
	user := &models.User{
		Name:     name,
		Email:    email,
		Password: hashedPassword,
		IsOnline: false,
	}

	if err := database.DB.Create(user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

func (s *UserService) Login(email, password string) (*models.User, error) {
	var user models.User
	if err := database.DB.Where("email = ?", email).First(&user).Error; err != nil {
		return nil, errors.New("invalid credentials")
	}

	if !utils.CheckPasswordHash(password, user.Password) {
		return nil, errors.New("invalid credentials")
	}

	return &user, nil
}

func (s *UserService) GetByID(id uint) (*models.User, error) {
	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *UserService) UpdateOnlineStatus(userID uint, isOnline bool, socketID string) error {
	return database.DB.Model(&models.User{}).
		Where("id = ?", userID).
		Updates(map[string]interface{}{
			"is_online": isOnline,
			"socket_id": socketID,
		}).Error
}