#!/bin/sh
set -eu

cd "$(dirname "$0")"
root=$(pwd -P)
puzzle="$root/../puzzle-term"
ansi_second_reality="$root/../ansi-second-reality"
pkg="$puzzle/dist/pkg"
player="$ansi_second_reality/build/web"
destination="$root/_site"

fail() {
    printf '%s\n' "$*" >&2
    exit 1
}

case "${1:-}" in
    '') [ "$#" -eq 0 ] || fail 'Usage: ./build.sh [--check]' ;;
    --check) [ "$#" -eq 1 ] || fail 'Usage: ./build.sh [--check]' ;;
    *) fail 'Usage: ./build.sh [--check]' ;;
esac

[ -d "$pkg" ] || fail 'Missing ../puzzle-term/dist/pkg. Supply a built Puzzle web package.'
[ -d "$player" ] || fail "Missing $player. Supply a built ANSI Second Reality web player."
for file in "$pkg/puzzle_web.js" "$pkg/puzzle_web_bg.wasm" "$pkg/LICENSE" \
    "$pkg/THIRD_PARTY_NOTICES.md" "$pkg/assets/JetBrainsMono-OFL.txt" \
    "$pkg/assets/NerdFontsSymbolsOnly-LICENSE" "$pkg/assets/NerdFontsSymbolsOnly-README.md" \
    "$player/ansi-second-reality.js" "$player/ansi-second-reality.wasm" \
    fonts/InterVariable.ttf fonts/Inter-OFL.txt; do
    [ -s "$file" ] || fail "Missing or empty build input: $file"
done
[ -d "$pkg/assets" ] || fail 'Missing Puzzle web assets.'
grep -Fq 'export function mountSecondReality' "$player/ansi-second-reality.js" ||
    fail 'The ANSI Second Reality web module does not export mountSecondReality. Supply the mount-enabled build.'
player_license="$ansi_second_reality/third_party/SecondRealityPlusPlus/LICENSE.md"
[ -s "$player_license" ] || fail 'Missing SecondReality++ Unlicense in the ANSI Second Reality checkout.'

puzzle_commit=$(git -C "$puzzle" rev-parse --verify HEAD)
player_commit=$(git -C "$ansi_second_reality" rev-parse --verify HEAD)
dirty() {
    # Dependency revisions describe tracked source. Untracked files never set this flag.
    changes=$(git -C "$1" status --porcelain --untracked-files=no) || return 1
    if [ -n "$changes" ]; then printf 'true'; else printf 'false'; fi
}
puzzle_dirty=$(dirty "$puzzle")
player_dirty=$(dirty "$ansi_second_reality")
built_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
if [ "${1:-}" = --check ]; then
    [ -f "$destination/build-info.json" ] || fail 'Build missing. Run ./build.sh first.'
    built_at=$(sed -n 's/^  "builtAt": "\([0-9TZ:-]*\)"$/\1/p' "$destination/build-info.json")
    case "$built_at" in
        ????-??-??T??:??:??Z) ;;
        *) fail 'Invalid build date. Run ./build.sh again.' ;;
    esac
fi

out=$(mktemp -d "$root/.site.XXXXXX")
trap 'rm -rf "$out"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
player_out="$out/ansi-second-reality"
mkdir "$out/puzzle" "$player_out"
cp index.html credits.html plasma.html "$out/"
cp -R css js img fonts "$out/"
cp "$pkg/puzzle_web.js" "$pkg/puzzle_web_bg.wasm" "$pkg/LICENSE" "$pkg/THIRD_PARTY_NOTICES.md" "$out/puzzle/"
cp -R "$pkg/assets" "$out/puzzle/"
cp "$player/ansi-second-reality.js" "$player/ansi-second-reality.wasm" "$player_out/"
cp notices/ansi-second-reality.txt "$player_out/NOTICES.txt"
cp "$player_license" "$player_out/SECOND-REALITY-UNLICENSE.txt"
touch "$out/.nojekyll"

cat > "$out/build-info.json" <<EOF_INFO
{
  "puzzle": { "commit": "$puzzle_commit", "dirty": $puzzle_dirty },
  "ansiSecondReality": { "commit": "$player_commit", "dirty": $player_dirty },
  "builtAt": "$built_at"
}
EOF_INFO

validate() {
    bad=$(find "$1" \( -type l -o -name '*.map' -o -name 'test' -o -name 'tests' \
        -o -name '*.test.*' -o -name '*.spec.*' -o -name 'test_*' -o -name '*-repro.html' \
        -o -name 'stress.js' -o -name 'stress.wasm' -o -name '.DS_Store' \) -print)
    [ -z "$bad" ] || fail "Unexpected files in site: $bad"
    leaks=$(find "$1" -type f -exec sh -c '
        LC_ALL=C grep -aFl -e "/Users/" "$@"
        code=$?
        [ "$code" -le 1 ]
    ' sh {} +) || fail 'Could not scan site files for absolute local paths.'
    [ -z "$leaks" ] || fail "Absolute local paths in site files: $leaks"
}

validate "$out"
if [ "${1:-}" = --check ]; then
    validate "$destination"
    diff -qr "$out" "$destination" || fail 'The site is stale. Run ./build.sh again.'
    printf 'Build is current (%s).\n' "$built_at"
    exit 0
fi

printf '%s\n' 'Largest files (bytes)'
(
    cd "$out"
    find . -type f -exec wc -c {} \; | sort -rn | awk '
        NR <= 8 { print }
        { total += $1; if ($1 > 100000000) large = 1 }
        END {
            printf "Total: %d bytes (%.2f MB)\n", total, total / 1000000;
            if (large || total > 1000000000) exit 1;
        }
    '
) || fail 'Site exceeds GitHub Pages size limits.'

rm -rf "$destination"
mv "$out" "$destination"
printf '%s\n' 'Built _site/'
