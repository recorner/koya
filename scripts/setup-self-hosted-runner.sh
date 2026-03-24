#!/usr/bin/env bash
# scripts/setup-self-hosted-runner.sh
# Manual runner setup on an existing EC2 instance.
# Usage: SSH into EC2 then: curl -sL <this-script-url> | bash -s -- <GITHUB_RUNNER_TOKEN>

set -euo pipefail

RUNNER_TOKEN="${1:?Usage: $0 <GITHUB_RUNNER_TOKEN>}"
GITHUB_ORG="${GITHUB_ORG:-westronet}"
GITHUB_REPO="${GITHUB_REPO:-koya}"
RUNNER_NAME="${RUNNER_NAME:-koya-runner-$(hostname)}"
RUNNER_LABELS="${RUNNER_LABELS:-self-hosted,linux,docker}"
RUNNER_DIR="/opt/actions-runner"

echo "=== Koya Self-Hosted Runner Setup ==="

# Prerequisites
echo "[1/6] Installing system packages..."
sudo apt-get update -y
sudo apt-get install -y curl jq unzip git

# Docker
echo "[2/6] Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

# Docker Compose
echo "[3/6] Installing Docker Compose..."
if ! command -v docker-compose &>/dev/null; then
  COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | jq -r .tag_name)
  sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
fi

# AWS CLI
echo "[4/6] Installing AWS CLI..."
if ! command -v aws &>/dev/null; then
  curl -s "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscliv2.zip
  unzip -q /tmp/awscliv2.zip -d /tmp
  sudo /tmp/aws/install
  rm -rf /tmp/aws /tmp/awscliv2.zip
fi

# Node.js + pnpm
echo "[5/6] Installing Node.js 22 + pnpm..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
  sudo apt-get install -y nodejs
  sudo npm install -g pnpm@10
fi

# GitHub Actions Runner
echo "[6/6] Setting up GitHub Actions runner..."
sudo mkdir -p "$RUNNER_DIR"
sudo chown "$USER:$USER" "$RUNNER_DIR"
cd "$RUNNER_DIR"

RUNNER_VERSION=$(curl -s https://api.github.com/repos/actions/runner/releases/latest | jq -r .tag_name | sed 's/v//')
curl -o actions-runner.tar.gz -L "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
tar xzf actions-runner.tar.gz
rm actions-runner.tar.gz

# Configure
./config.sh \
  --url "https://github.com/${GITHUB_ORG}/${GITHUB_REPO}" \
  --token "$RUNNER_TOKEN" \
  --name "$RUNNER_NAME" \
  --labels "$RUNNER_LABELS" \
  --unattended \
  --replace

# Install as service
sudo ./svc.sh install "$USER"
sudo ./svc.sh start

echo ""
echo "=== Runner setup complete ==="
echo "Runner name: $RUNNER_NAME"
echo "Labels: $RUNNER_LABELS"
echo "Status: $(sudo ./svc.sh status)"
