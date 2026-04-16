#!/bin/bash
set -e

echo "Uninstalling OpenAgent..."

rm -f /usr/local/bin/openagent
rm -rf /usr/local/lib/openagent

echo "OpenAgent uninstalled."
echo "Config at ~/.openagent/ was kept. Delete it manually if you want."
