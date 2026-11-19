#!/bin/sh
set -eu

cd "$(dirname "$0")"
[ "$#" -eq 0 ] || { printf '%s\n' 'Usage: ./deploy.sh' >&2; exit 1; }

fail() {
    printf '%s\n' "$*" >&2
    exit 1
}

expected=https://github.com/lateshift/puzzleweb.git
fetch_url=$(git remote get-url --all origin) || fail "Set origin to $expected."
push_url=$(git remote get-url --push --all origin) || fail "Set origin to $expected."
[ "$fetch_url" = "$expected" ] && [ "$push_url" = "$expected" ] ||
    fail "Both fetch and push URLs for origin must be $expected."

changes=$(git status --porcelain --untracked-files=normal)
[ -z "$changes" ] || fail 'Commit source changes before preparing the deployment.'
./build.sh --check

date=$(sed -n 's/^  "builtAt": "\([0-9-]*\)T.*"$/\1/p' _site/build-info.json)
puzzle=$(sed -n 's/^  "puzzle": { "commit": "\([a-f0-9]*\)".*/\1/p' _site/build-info.json | cut -c1-12)
player=$(sed -n 's/^  "ansiSecondReality": { "commit": "\([a-f0-9]*\)".*/\1/p' _site/build-info.json | cut -c1-12)
[ -n "$date" ] && [ -n "$puzzle" ] && [ -n "$player" ] || fail 'Incomplete build metadata.'

temporary=$(mktemp -d "${TMPDIR:-/tmp}/puzzleweb-deploy.XXXXXX")
worktree="$temporary/gh-pages"
cleanup() {
    if [ -f "$worktree/.git" ]; then git worktree remove --force "$worktree"; fi
    rm -rf "$temporary"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if git show-ref --verify --quiet refs/heads/gh-pages; then
    git worktree add "$worktree" gh-pages
    git -C "$worktree" rm -q -rf --ignore-unmatch .
else
    git worktree add --detach "$worktree" HEAD
    git -C "$worktree" switch --orphan gh-pages
fi

cp -R _site/. "$worktree/"
git -C "$worktree" add -f --all
git -C "$worktree" commit --allow-empty -m "Deploy $date (puzzle $puzzle, ANSI Second Reality $player)"
printf '\n%s\n' 'git push origin gh-pages'
