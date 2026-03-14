install: ## Initialize the project and install dependencies
	@echo "🔧 Initializing the project..."
	pnpm install

install-frozen: ## Install dependencies with frozen lockfile
	@echo "🔧 Installing dependencies with frozen lockfile..."
	pnpm install --frozen-lockfile

update: ## Update dependencies to their latest versions
	@echo "🔄 Updating dependencies..."
	pnpm update

check: ## Check the codebase using Biome
	@echo "🔍 Checking codebase..."
	pnpm run check

build-development: ## Build the project for development (fast, no type check)
	@echo "🔧 Building the project..."
	pnpm run build

build-production: ## Build the project for production (fast, no type check)
	@echo "🔧 Building the project..."
	pnpm run build

deploy: ## Deploy the project to Cloudflare Workers
	@echo "🚀 Deploying to Cloudflare Workers..."
	pnpm run deploy

dev: ## Start the development server
	@echo "💻 Starting development server..."
	pnpm run dev

preview: ## Preview the production build locally
	@echo "👀 Previewing production build..."
	pnpm run preview

check-types: ## Check TypeScript types
	@echo "🔍 Checking TypeScript types..."
	pnpm run check-types

types: ## Generate worker-configuration.d.ts files recursively
	@echo "📄 Generating TypeScript type definitions..."
	pnpm run types

format: ## Format the codebase using Biome
	@echo "📝 Formatting code..."
	pnpm run format

lint: ## Lint the codebase using Biome
	@echo "🔍 Running code analysis..."
	pnpm run lint

ci: ## Run full checks before committing for CI/CD pipeline (lint, format, check)
	@echo "🔍 Running CI checks..."
	pnpm run check && pnpm run lint && pnpm run format
