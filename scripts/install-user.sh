#!/bin/bash
set -e

INSTALL_DIR="$HOME/.openagent/app"
BIN_DIR="$HOME/.local/bin"
BIN_LINK="$BIN_DIR/openagent"

echo ""
echo "  Installing OpenAgent..."
echo ""

if ! command -v node &>/dev/null; then
  echo "  Node.js not found. Installing..."
  if command -v apt-get &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>/dev/null
    sudo apt-get install -y nodejs 2>/dev/null
  elif command -v brew &>/dev/null; then
    brew install node@20 2>/dev/null
  elif command -v pacman &>/dev/null; then
    sudo pacman -S nodejs npm --noconfirm 2>/dev/null
  else
    echo "  Please install Node.js 20+ manually: https://nodejs.org"
    exit 1
  fi
fi

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "  Node.js 18+ required. You have $(node -v)."
  exit 1
fi

mkdir -p "$INSTALL_DIR" "$BIN_DIR"

if [ -d "$INSTALL_DIR/node_modules" ]; then
  echo "  Removing previous installation..."
  rm -rf "$INSTALL_DIR"
  mkdir -p "$INSTALL_DIR"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cp "$SCRIPT_DIR/package.json" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/tsconfig.json" "$INSTALL_DIR/"
cp -R "$SCRIPT_DIR/src" "$INSTALL_DIR/src"
cp -R "$SCRIPT_DIR/bin" "$INSTALL_DIR/bin"

cd "$INSTALL_DIR"
echo "  Installing dependencies..."
npm install --loglevel=error 2>&1 | tail -5
npm install tsx --loglevel=error 2>&1 | tail -1

cat > "$BIN_LINK" << SCRIPT
#!/bin/bash
exec "$INSTALL_DIR/node_modules/.bin/tsx" "$INSTALL_DIR/src/entrypoints/cli.tsx" "\$@"
SCRIPT
chmod +x "$BIN_LINK"

SHELL_RC=""
if [ -f "$HOME/.zshrc" ]; then
  SHELL_RC="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
  SHELL_RC="$HOME/.bashrc"
elif [ -f "$HOME/.profile" ]; then
  SHELL_RC="$HOME/.profile"
fi

if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  if [ -n "$SHELL_RC" ]; then
    echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> "$SHELL_RC"
    echo "  Added ~/.local/bin to PATH in $SHELL_RC"
  fi
fi

echo ""
echo "  OpenAgent installed!"
echo ""
echo "  Run: openagent"
echo ""

if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo "  First, reload your shell:"
  echo "    source $SHELL_RC"
  echo ""
fi
