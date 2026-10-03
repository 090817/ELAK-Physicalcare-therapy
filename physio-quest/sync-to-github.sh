#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$ROOT/.." && pwd)/ELAK-Physicalcare-therapy"
REMOTE="https://github.com/090817/ELAK-Physicalcare-therapy.git"

if [[ ! -d "$REPO/.git" ]]; then
  git clone "$REMOTE" "$REPO"
fi

git -C "$REPO" pull --ff-only origin main

for f in index.html clinician.html shared.js clinic.js agent.js shape-grid.js pattern-waves.js elak-logo.png hero.png; do
  cp "$ROOT/$f" "$REPO/patient/$f"
done

git -C "$REPO" add patient
if git -C "$REPO" diff --cached --quiet; then
  echo "Already up to date on GitHub."
  exit 0
fi

git -C "$REPO" commit -m "$(cat <<'EOF'
Update the patient ankle rehab game from the laptop.

EOF
)"
git -C "$REPO" push origin HEAD
echo "Pushed to https://github.com/090817/ELAK-Physicalcare-therapy"
