package models

import (
	"time"

	"gorm.io/gorm"
)

type Room struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Code     string     `gorm:"type:varchar(255);unique;not null" json:"room_code"`
	User1ID  uint       `gorm:"not null" json:"user1_id"`
	User2ID  uint       `gorm:"not null" json:"user2_id"`
	IsActive bool       `gorm:"default:true" json:"is_active"`
	EndedAt  *time.Time `json:"ended_at,omitempty"`

	User1 User `gorm:"foreignKey:User1ID" json:"user1,omitempty"`
	User2 User `gorm:"foreignKey:User2ID" json:"user2,omitempty"`
}

type Connection struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	RoomID   uint   `gorm:"not null" json:"room_id"`
	UserID   uint   `gorm:"not null" json:"user_id"`
	SocketID string `gorm:"type:varchar(255);not null" json:"socket_id"`
	IsActive bool   `gorm:"default:true" json:"is_active"`

	Room Room `gorm:"foreignKey:RoomID" json:"room,omitempty"`
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}
