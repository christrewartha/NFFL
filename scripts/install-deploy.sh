#!/usr/bin/env bash
# One-off setup for automatic deploys. From the repo folder, run:
#   sudo scripts/install-deploy.sh
# Adds a systemd timer that runs scripts/deploy.sh every 2 minutes as your user, and a
# sudo rule letting it restart the league server (and nothing else) without a password.
set -euo pipefail

[ "$(id -u)" = 0 ] || { echo "Run this with sudo: sudo scripts/install-deploy.sh"; exit 1; }
USER_NAME=${SUDO_USER:?Run this with sudo from your normal account, not as root}
REPO=$(cd "$(dirname "$0")/.." && pwd)
SYSTEMCTL=$(command -v systemctl)

cat > /etc/systemd/system/nffl-deploy.service <<EOF
[Unit]
Description=Deploy new NFFL commits from GitHub
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=$USER_NAME
WorkingDirectory=$REPO
ExecStart=$REPO/scripts/deploy.sh
EOF

cat > /etc/systemd/system/nffl-deploy.timer <<EOF
[Unit]
Description=Check GitHub for NFFL updates every 2 minutes

[Timer]
OnCalendar=*:0/2

[Install]
WantedBy=timers.target
EOF

# Files in sudoers.d with a dot in the name are ignored, so check the rule under a
# temporary name first: a broken sudoers file can lock you out of sudo.
RULE_FILE=/etc/sudoers.d/nffl-deploy
echo "$USER_NAME ALL=(root) NOPASSWD: $SYSTEMCTL restart nffl" > "$RULE_FILE.new"
chmod 440 "$RULE_FILE.new"
visudo -cf "$RULE_FILE.new" >/dev/null
mv "$RULE_FILE.new" "$RULE_FILE"

chmod +x "$REPO/scripts/deploy.sh"
systemctl daemon-reload
systemctl enable --now nffl-deploy.timer

echo "Automatic deploys are on. New commits on GitHub go live within about 2 minutes."
echo "  Next check:   systemctl list-timers nffl-deploy"
echo "  Deploy log:   journalctl -u nffl-deploy -f"
