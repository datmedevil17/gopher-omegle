package database

import (
	"log"
	"github.com/datmedevil17/gopher-omegle/internal/models"
)

func Migrate() error {
	log.Println("Running database migrations...")

	err := DB.AutoMigrate(
		&models.User{},
		&models.Room{},
		&models.Connection{},
	)

	if err != nil {
		return err
	}

	log.Println("Database migrations completed successfully")
	return nil
}