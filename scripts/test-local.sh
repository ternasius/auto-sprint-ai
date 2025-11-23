#!/bin/bash

# Auto Sprint AI - Local Testing Script
# This script helps set up and run local testing with forge tunnel

set -e

echo "=================================="
echo "Auto Sprint AI - Local Testing"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Step 1: Check prerequisites
echo "Step 1: Checking prerequisites..."
echo ""

if command_exists forge; then
    FORGE_VERSION=$(forge --version)
    print_status "Forge CLI installed: $FORGE_VERSION"
else
    print_error "Forge CLI not found. Install with: npm install -g @forge/cli"
    exit 1
fi

if command_exists node; then
    NODE_VERSION=$(node --version)
    print_status "Node.js installed: $NODE_VERSION"
else
    print_error "Node.js not found. Please install Node.js >= 18.0.0"
    exit 1
fi

if command_exists npm; then
    NPM_VERSION=$(npm --version)
    print_status "npm installed: $NPM_VERSION"
else
    print_error "npm not found. Please install npm"
    exit 1
fi

echo ""

# Step 2: Check if logged in to Forge
echo "Step 2: Checking Forge authentication..."
echo ""

if forge whoami >/dev/null 2>&1; then
    FORGE_USER=$(forge whoami)
    print_status "Logged in as: $FORGE_USER"
else
    print_warning "Not logged in to Forge"
    echo "Please run: forge login"
    exit 1
fi

echo ""

# Step 3: Install dependencies
echo "Step 3: Installing dependencies..."
echo ""

if [ -f "package.json" ]; then
    npm install
    print_status "Dependencies installed"
else
    print_error "package.json not found. Are you in the correct directory?"
    exit 1
fi

echo ""

# Step 4: Build the project
echo "Step 4: Building the project..."
echo ""

npm run build
if [ $? -eq 0 ]; then
    print_status "Build successful"
else
    print_error "Build failed. Please check for errors above."
    exit 1
fi

echo ""

# Step 5: Check if app is registered
echo "Step 5: Checking app registration..."
echo ""

if [ -f "manifest.yml" ]; then
    if grep -q "app:" manifest.yml; then
        print_status "App is registered"
    else
        print_warning "App may not be registered. Run: forge register"
    fi
else
    print_error "manifest.yml not found"
    exit 1
fi

echo ""

# Step 6: Prompt for deployment
echo "Step 6: Deployment check..."
echo ""

read -p "Have you deployed the app at least once? (y/n): " DEPLOYED

if [ "$DEPLOYED" != "y" ] && [ "$DEPLOYED" != "Y" ]; then
    print_warning "You need to deploy at least once before using tunnel"
    echo "Run: forge deploy"
    echo ""
    read -p "Deploy now? (y/n): " DEPLOY_NOW
    
    if [ "$DEPLOY_NOW" = "y" ] || [ "$DEPLOY_NOW" = "Y" ]; then
        forge deploy
        print_status "Deployment complete"
    else
        echo "Please deploy manually and run this script again"
        exit 0
    fi
fi

echo ""

# Step 7: Prompt for installation
echo "Step 7: Installation check..."
echo ""

read -p "Have you installed the app in a test Jira site? (y/n): " INSTALLED

if [ "$INSTALLED" != "y" ] && [ "$INSTALLED" != "Y" ]; then
    print_warning "You need to install the app in a Jira site"
    echo "Run: forge install"
    echo ""
    read -p "Install now? (y/n): " INSTALL_NOW
    
    if [ "$INSTALL_NOW" = "y" ] || [ "$INSTALL_NOW" = "Y" ]; then
        forge install
        print_status "Installation complete"
    else
        echo "Please install manually and run this script again"
        exit 0
    fi
fi

echo ""

# Step 8: Display testing information
echo "=================================="
echo "Ready to Start Testing!"
echo "=================================="
echo ""
echo "Testing Resources:"
echo "  📖 Testing Guide: TESTING_GUIDE.md"
echo "  ✅ Test Checklist: TEST_CHECKLIST.md"
echo ""
echo "What to test:"
echo "  1. Sprint Analysis Panel (Jira Project Page)"
echo "  2. Issue Panel (Sprint View)"
echo "  3. Confluence Macro (if available)"
echo "  4. Data collection from Jira and Bitbucket"
echo "  5. Various sprint sizes and states"
echo "  6. Error handling and edge cases"
echo ""
echo "Monitoring:"
echo "  - Watch the tunnel logs for API calls and errors"
echo "  - Check browser console for client-side errors"
echo "  - Use the test checklist to track progress"
echo ""

# Step 9: Start forge tunnel
echo "=================================="
echo "Starting Forge Tunnel..."
echo "=================================="
echo ""
print_warning "Keep this terminal open while testing"
print_warning "Press Ctrl+C to stop the tunnel"
echo ""
echo "Tunnel will start in 3 seconds..."
sleep 3

forge tunnel
