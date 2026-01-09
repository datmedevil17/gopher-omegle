.PHONY: build run dev docker-up docker-down migrate test clean

build:
	go build -o bin/main cmd/api/main.go

run:
	go run cmd/api/main.go

dev:
	air

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-build:
	docker-compose up --build -d

migrate:
	go run cmd/api/main.go migrate

test:
	go test -v ./...

clean:
	rm -rf bin/
	docker-compose down -v

logs:
	docker-compose logs -f api