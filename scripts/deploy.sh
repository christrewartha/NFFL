#!/usr/bin/env bash
# Deploy new commits from GitHub, if there are any. Run every couple of minutes by the
# nffl-deploy systemd timer (set up once with: sudo scripts/install-deploy.sh).
#
# Backs up the database, then tests and builds the new version while the old one keeps
# serving. The server is only restarted once that passes, and if anything fails
# (tests, build, or the server not coming back) the previous version is put back.
set -euo pipefail
cd "$(dirname "$0")/.."

BRANCH=main
PORT=${PORT:-8787}
# A commit that failed to deploy is remembered here (inside .git, so git ignores it)
# and not retried every 2 minutes. The next push gets a fresh attempt.
FAILED=.git/nffl-deploy-failed
log() { echo "[deploy] $*"; }

deps_changed() { ! git diff --quiet "$1" "$2" -- package.json package-lock.json; }

# Each step returns explicitly: bash ignores `set -e` inside a function called with ||.
build() {
  if deps_changed "$1" HEAD; then npm ci --no-audit --no-fund || return 1; fi
  npm test || return 1
  npm run build || return 1
}

restart() { sudo -n systemctl restart nffl; }

healthy() {
  for _ in $(seq 1 20); do
    curl -fsS -o /dev/null "http://localhost:$PORT/league" && return 0
    sleep 1
  done
  return 1
}

rollback() {
  log "FAILED: $1. Putting ${OLD:0:7} back. Push a fix to try again."
  echo "$NEW" > "$FAILED"
  git reset --quiet --keep "$OLD" || { log "Couldn't roll back without losing local edits. Run 'git status' in $(pwd)."; exit 1; }
  if deps_changed "$NEW" "$OLD"; then npm ci --no-audit --no-fund; fi
  npm run build
  restart
  healthy || log "The previous version isn't responding either. Check: journalctl -u nffl"
  exit 1
}

# The steps live in a function so bash has read all of them before `git merge` can
# replace this file mid-run; `exit` on the same line stops it reading any further.
main() {
  git fetch --quiet origin "$BRANCH"
  OLD=$(git rev-parse HEAD)
  NEW=$(git rev-parse "origin/$BRANCH")
  [ "$OLD" = "$NEW" ] && return 0
  [ -f "$FAILED" ] && [ "$(cat "$FAILED")" = "$NEW" ] && return 0

  log "Deploying $(git log --format='%h %s' -1 "$NEW") (was ${OLD:0:7})"

  if [ -f server/nffl.db ]; then node server/backup.mjs; fi

  if ! git merge --quiet --ff-only "$NEW"; then
    log "FAILED: local edits on the server clash with this update. Sort them out ('git status' in $(pwd)), then retry with: rm $(pwd)/$FAILED"
    echo "$NEW" > "$FAILED"
    exit 1
  fi

  build "$OLD" || rollback "tests or build failed"
  restart
  healthy || rollback "the server didn't come back after restarting"
  rm -f "$FAILED"
  log "Deployed ${NEW:0:7}"
}

main "$@"; exit $?
