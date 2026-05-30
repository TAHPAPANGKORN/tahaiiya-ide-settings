#!/bin/bash
set -e

# Check if Node.js is installed
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo "Node.js or npm is not installed!"
    
    OS_TYPE="$(uname -s)"
    
    # macOS
    if [[ "$OS_TYPE" == "Darwin" ]]; then
        # install with brew
        if command -v brew &> /dev/null; then
            echo "macOS detected. Installing Node.js via Homebrew..."
            brew install node
        else
            echo "Homebrew not found. Downloading precompiled Node.js binary..."
            ARCH="$(uname -m)"
            # Apple silicon
            if [[ "$ARCH" == "arm64" ]]; then
                NODE_ARCH="darwin-arm64"
            else
                NODE_ARCH="darwin-x64"
            fi
            NODE_VER="v20.11.1" # Safe LTS version
            
            DOWNLOAD_LOCAL_NODE=true
        fi
    # install with apt
    elif [[ "$OS_TYPE" == "Linux" ]]; then
        # Ubuntu / Debian / WSL
        if command -v apt-get &> /dev/null; then
            echo "Ubuntu/Debian/WSL detected. Installing Node.js via apt (may require sudo password)..."
            sudo apt-get update && sudo apt-get install -y nodejs npm
        else
            echo "Linux detected but package manager 'apt-get' not found. Please install Node.js manually."
            exit 1
        fi
    # install with winget 
    elif [[ "$OS_TYPE" == "MINGW"* || "$OS_TYPE" == "MSYS"* || "$OS_TYPE" == "CYGWIN"* ]]; then
        # Windows (Git Bash / MSYS)
        if command -v winget &> /dev/null; then
            echo "Windows detected. Installing Node.js via winget..."
            winget install OpenJS.NodeJS
        else
            echo "Windows detected but 'winget' not found. Please install Node.js from https://nodejs.org/"
            exit 1
        fi
    else
        echo "Node.js is required. Please install Node.js (https://nodejs.org) to proceed."
        exit 1
    fi
fi

# make temp dir
TEMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t 'ide_installer')

# Download Node.js locally if the flag is set
if [ "$DOWNLOAD_LOCAL_NODE" = true ]; then
    echo "Downloading Node.js ${NODE_VER}..."
    curl -fsSL "https://nodejs.org/dist/${NODE_VER}/node-${NODE_VER}-${NODE_ARCH}.tar.gz" -o "${TEMP_DIR}/node.tar.gz"
    mkdir -p "${TEMP_DIR}/node-bin"
    tar -xzf "${TEMP_DIR}/node.tar.gz" -C "${TEMP_DIR}/node-bin" --strip-components=1
    rm "${TEMP_DIR}/node.tar.gz"
    export PATH="${TEMP_DIR}/node-bin/bin:$PATH"
fi

# clone repo
echo "Fetching IDE Settings Installer..."
git clone --depth 1 https://github.com/TAHPAPANGKORN/tahaiiya-ide-settings.git "$TEMP_DIR" > /dev/null 2>&1

# install npm
cd "$TEMP_DIR"
echo "Installing dependencies..."
npm install --silent
echo "Launching installer..."
node src/index.js

# clean git folder
rm -rf "$TEMP_DIR"
