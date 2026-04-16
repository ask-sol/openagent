#!/bin/bash
set -e

INSTALL_DIR="/usr/local/lib/openagent"
BIN_LINK="/usr/local/bin/openagent"

echo "Installing OpenAgent..."

if [ -d "$INSTALL_DIR" ]; then
  echo "Removing previous installation..."
  rm -rf "$INSTALL_DIR"
fi

mkdir -p "$INSTALL_DIR"

cp -R "$(dirname "$0")/../package.json" "$INSTALL_DIR/"
cp -R "$(dirname "$0")/../src" "$INSTALL_DIR/src"
cp -R "$(dirname "$0")/../bin" "$INSTALL_DIR/bin"
cp -R "$(dirname "$0")/../tsconfig.json" "$INSTALL_DIR/"

cd "$INSTALL_DIR"
npm install --production 2>&1 | tail -3
npm install tsx 2>&1 | tail -1

cat > "$INSTALL_DIR/bin/run.sh" << 'SCRIPT'
#!/bin/bash
exec npx --prefix /usr/local/lib/openagent tsx /usr/local/lib/openagent/src/entrypoints/cli.tsx "$@"
SCRIPT
chmod +x "$INSTALL_DIR/bin/run.sh"

rm -f "$BIN_LINK"
ln -s "$INSTALL_DIR/bin/run.sh" "$BIN_LINK"

echo ""
echo "OpenAgent installed successfully!"
echo "Run 'openagent' from any terminal to start."
