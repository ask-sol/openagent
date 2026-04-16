#!/bin/bash
set -e

INSTALL_DIR="$HOME/.openagent/app"
BIN_DIR="$HOME/.local/bin"
BIN_LINK="$BIN_DIR/openagent"

echo "Installing OpenAgent to $INSTALL_DIR..."

mkdir -p "$INSTALL_DIR" "$BIN_DIR"

if [ -d "$INSTALL_DIR/node_modules" ]; then
  echo "Removing previous installation..."
  rm -rf "$INSTALL_DIR"
  mkdir -p "$INSTALL_DIR"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cp "$SCRIPT_DIR/package.json" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/tsconfig.json" "$INSTALL_DIR/"
cp -R "$SCRIPT_DIR/src" "$INSTALL_DIR/src"
cp -R "$SCRIPT_DIR/bin" "$INSTALL_DIR/bin"

cd "$INSTALL_DIR"
npm install 2>&1 | tail -3
npm install tsx 2>&1 | tail -1

cat > "$BIN_LINK" << SCRIPT
#!/bin/bash
exec "$INSTALL_DIR/node_modules/.bin/tsx" "$INSTALL_DIR/src/entrypoints/cli.tsx" "\$@"
SCRIPT
chmod +x "$BIN_LINK"

echo ""
echo "OpenAgent installed!"
echo ""

if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo "Add this to your ~/.zshrc:"
  echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo ""
  echo "Then run: source ~/.zshrc"
  echo ""
fi

echo "Run 'openagent' to start."
