#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Pigeon × Endee — First-Time Setup Script
# Run this once to configure Docker permissions and build images
# Usage: chmod +x setup.sh && ./setup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Pigeon × Endee — First Time Setup  ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo

# ── 1. Check Docker is installed ──────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found. Install it from https://docs.docker.com/engine/install/${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker found: $(docker --version 2>/dev/null || sudo docker --version)${NC}"

# ── 1b. Detect compose command (plugin vs standalone) ─────────────────────────
if docker compose version &>/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
else
    echo -e "${YELLOW}⚠  docker compose plugin not found. Installing...${NC}"
    sudo apt-get update -qq && sudo apt-get install -y docker-compose-plugin
    if docker compose version &>/dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
        echo -e "${GREEN}✓ docker compose plugin installed${NC}"
    else
        echo -e "${RED}✗ Could not install docker-compose-plugin. Run: sudo apt-get install docker-compose-plugin${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✓ Compose command: ${COMPOSE_CMD}${NC}"

# ── 2. Fix Docker socket permissions (add user to docker group) ────────────────
if ! docker ps &>/dev/null 2>&1; then
    echo -e "${YELLOW}ℹ Docker requires elevated permissions. Adding you to the docker group...${NC}"
    sudo usermod -aG docker "$USER"
    echo -e "${GREEN}✓ Added $USER to the docker group.${NC}"
    echo -e "${YELLOW}⚠  Please log out and back in (or run: newgrp docker) for this to take effect.${NC}"
    echo -e "${YELLOW}   Then re-run this script.${NC}"
    echo
    echo -e "   Alternatively, prefix all docker/make commands with ${YELLOW}sudo${NC}:"
    echo -e "   ${YELLOW}sudo ${COMPOSE_CMD} up -d${NC}"
    echo
fi

# ── 3. Copy .env.example → .env.local if not present ────────────────────────
if [ ! -f .env.local ]; then
    cp .env.example .env.local
    echo -e "${GREEN}✓ Created .env.local from .env.example${NC}"
    echo -e "${YELLOW}  Edit .env.local and add your GROQ_API_KEY before starting.${NC}"
else
    echo -e "${GREEN}✓ .env.local already exists${NC}"
fi

# ── 4. Detect native arch for Endee build ────────────────────────────────────
ARCH=$(uname -m)
case "$ARCH" in
    x86_64) BUILD_ARCH="avx2" ;;
    aarch64|arm64) BUILD_ARCH="neon" ;;
    *) BUILD_ARCH="avx2" ;;
esac
echo -e "${GREEN}✓ Detected build arch: ${BUILD_ARCH}${NC}"

# ── 5. Build Endee image from source ─────────────────────────────────────────
echo
echo -e "${BLUE}Building Endee vector DB from source (this takes 3-5 minutes first time)...${NC}"
DOCKER_CMD="docker"
if ! docker ps &>/dev/null 2>&1; then DOCKER_CMD="sudo docker"; fi

$DOCKER_CMD build \
    --file infra/Dockerfile \
    --build-arg BUILD_ARCH="${BUILD_ARCH}" \
    --build-arg DEBUG=false \
    --tag endee-oss:latest \
    .
echo -e "${GREEN}✓ endee-oss:latest built successfully${NC}"

# ── 6. Build Pigeon app image ─────────────────────────────────────────────────
echo
echo -e "${BLUE}Building Pigeon Next.js app image...${NC}"
$DOCKER_CMD build --tag pigeon-app:latest .
echo -e "${GREEN}✓ pigeon-app:latest built successfully${NC}"

# ── 7. Done! ──────────────────────────────────────────────────────────────────
echo
echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Setup Complete! 🎉                ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
echo
echo -e "Start the full stack:"
echo -e "  ${YELLOW}${COMPOSE_CMD} up -d${NC}      (or: make up)"
echo
echo -e "URLs:"
echo -e "  Pigeon app → ${BLUE}http://localhost:3000${NC}"
echo -e "  Endee DB   → ${BLUE}http://localhost:8080${NC}"
echo
echo -e "Other useful commands:"
echo -e "  ${YELLOW}${COMPOSE_CMD} logs -f${NC}   — tail all logs"
echo -e "  ${YELLOW}${COMPOSE_CMD} down${NC}      — stop everything"
echo -e "  ${YELLOW}make help${NC}                — list all make targets"
