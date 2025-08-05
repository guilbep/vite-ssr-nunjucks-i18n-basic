# INPLUGS CO2 Multi-Locale Application Makefile
# Usage: make <target>

.PHONY: help clean dev build prod run up down recreate install lint test

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE=\033[0;34m
GREEN=\033[0;32m
YELLOW=\033[1;33m
RED=\033[0;31m
NC=\033[0m # No Color

##@ Help
help: ## Display this help message
	@echo "$(BLUE)INPLUGS CO2 Multi-Locale Application$(NC)"
	@echo "$(BLUE)=====================================$(NC)"
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make $(YELLOW)<target>$(NC)\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(BLUE)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Development
dev: ## Start development server
	@echo "$(GREEN)Starting development server...$(NC)"
	npm run dev

run: dev ## Alias for dev

install: ## Install dependencies
	@echo "$(GREEN)Installing dependencies...$(NC)"
	npm install

##@ Build & Production
clean: ## Clean dist directory
	@echo "$(YELLOW)Cleaning dist directory...$(NC)"
	rm -rf dist/
	@echo "$(GREEN)✓ Cleaned dist directory$(NC)"

build: clean ## Build for production
	@echo "$(GREEN)Building for production...$(NC)"
	npm run build
	@echo "$(GREEN)✓ Production build complete$(NC)"

prod: build ## Build and serve production locally
	@echo "$(GREEN)Serving production build locally...$(NC)"
	npm run preview

##@ Docker Management
up: ## Start Docker containers
	@echo "$(GREEN)Starting Docker containers...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)✓ Containers started$(NC)"

down: ## Stop Docker containers
	@echo "$(YELLOW)Stopping Docker containers...$(NC)"
	docker-compose down
	@echo "$(GREEN)✓ Containers stopped$(NC)"

recreate: down ## Recreate Docker containers (down + build + up)
	@echo "$(GREEN)Recreating Docker containers...$(NC)"
	docker-compose build --no-cache
	docker-compose up -d
	@echo "$(GREEN)✓ Containers recreated$(NC)"

##@ Utilities
lint: ## Run linting
	@echo "$(GREEN)Running linter...$(NC)"
	npm run lint || echo "$(YELLOW)No lint script found$(NC)"

test: ## Run tests
	@echo "$(GREEN)Running tests...$(NC)"
	npm run test || echo "$(YELLOW)No test script found$(NC)"

logs: ## View Docker logs
	@echo "$(GREEN)Showing Docker logs...$(NC)"
	docker-compose logs -f

status: ## Show Docker container status
	@echo "$(GREEN)Docker container status:$(NC)"
	docker-compose ps

##@ Quick Commands
fresh: clean install build ## Fresh install and build
	@echo "$(GREEN)✓ Fresh build complete$(NC)"

restart: down up ## Restart Docker containers
	@echo "$(GREEN)✓ Containers restarted$(NC)"

deploy: build recreate ## Deploy to production (build + recreate containers)
	@echo "$(GREEN)✓ Deployment complete$(NC)"