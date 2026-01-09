package models

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	
	Name      string `gorm:"type:varchar(255);not null" json:"name"`
	Email     string `gorm:"type:varchar(255);unique;not null" json:"email"`
	Password  string `gorm:"type:varchar(255);not null" json:"-"`
	IsOnline  bool   `gorm:"default:false" json:"is_online"`
	SocketID  string `gorm:"type:varchar(255)" json:"socket_id,omitempty"`
}

type UserResponse struct {
	ID       uint      `json:"id"`
	Name     string    `json:"name"`
	Email    string    `json:"email"`
	IsOnline bool      `json:"is_online"`
	CreatedAt time.Time `json:"created_at"`
}

func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:       u.ID,
		Name:     u.Name,
		Email:    u.Email,
		IsOnline: u.IsOnline,
		CreatedAt: u.CreatedAt,
	}
}