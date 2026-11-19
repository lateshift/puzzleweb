# Third-party notices

Puzzle Terminal is MIT licensed.

## Slug

The CPU oracle is a faithful Rust port of Eric Lengyel's Slug reference pixel shader (Copyright 2017, Eric Lengyel), from commit `be3c13eb7d63f9e8aa5c583e42d92c374cb91d98`. The reference sources and their MIT and Apache-2.0 licenses are in `crates/puzzle-slug/reference/`. [Upstream](https://github.com/EricLengyel/Slug).

## Bundled fonts

JetBrains Mono v2.304 is Copyright JetBrains s.r.o. and distributed under SIL OFL 1.1 (`assets/fonts/JetBrainsMono-OFL.txt`). SHA-256: regular variable `662a196d58f1183bf2d77428b6d5283fe3f45161ab021bea4036bc98e5cac016`; italic variable `f115aaa12113718c02ce72864fe6823b87241bc23d3e44cf1220155f861063f2`.

Symbols Nerd Font Mono v3.5.1 is distributed under its bundled MIT license (`assets/fonts/NerdFontsSymbolsOnly-LICENSE`). SHA-256: `fe471e538392f51910faab985fa8e192a39dd3426125edd15b71b3680df0e749`. Its included icon sets have the license designations in `assets/fonts/NerdFontsSymbolsOnly-README.md`. Sources and roles are in `assets/fonts/README.md`.

## Test font (D-37; never distributed)

The COLRv1 fixture `assets/fonts/test/test_glyphs-glyf_colr_1.ttf` comes from [googlefonts/color-fonts](https://github.com/googlefonts/color-fonts), revision `0046ea4c3b69e9fbbe464c2594816894e3aa5e4b`, Apache-2.0. Its license and SHA-256 are preserved in `assets/fonts/test/`. Tests and goldens only; live reviews use system fonts.

## Built-in theme palettes (D-25)

The ten third-party theme JSON files under `assets/themes/` copy terminal color values from these pinned official palette sources. Each theme's `credit` embeds its repository, commit and license. Missing UI colors are Puzzle Terminal derivations in OKLab (§14.6), not colors attributed to the source project. A source without a cursor or selection value leaves that field `null`; Puzzle derives it at runtime. The four `puzzle-*` palettes are original MIT-licensed work.

| Theme | Official source, pinned commit and license |
|---|---|
| Catppuccin Latte, Mocha | [`catppuccin/kitty` `themes/latte.conf` and `themes/mocha.conf`](https://github.com/catppuccin/kitty/tree/43098316202b84d6a71f71aaf8360f102f4d3f1a/themes), commit `43098316202b84d6a71f71aaf8360f102f4d3f1a`, MIT; license copied to `assets/themes/licenses/Catppuccin-MIT.txt`. |
| Dracula | [`dracula/kitty` `dracula.conf`](https://github.com/dracula/kitty/blob/87717a3f00e3dff0fc10c93f5ff535ea4092de70/dracula.conf), commit `87717a3f00e3dff0fc10c93f5ff535ea4092de70`, MIT; license copied to `assets/themes/licenses/Dracula-MIT.txt`. |
| Solarized Light, Dark | [`altercation/solarized` `xresources/solarized`](https://github.com/altercation/solarized/blob/62f656a02f93c5190a8753159e34b385588d5ff3/xresources/solarized), commit `62f656a02f93c5190a8753159e34b385588d5ff3`, MIT; license copied to `assets/themes/licenses/Solarized-MIT.txt`. The light mode uses the alternate base definitions in that file's Light section. |
| Gruvbox Light, Dark | [`morhetz/gruvbox-contrib` Xresources](https://github.com/morhetz/gruvbox-contrib/tree/150e9ca30fcd679400dc388c24930e5ec8c98a9f/xresources), commit `150e9ca30fcd679400dc388c24930e5ec8c98a9f`. The original [`morhetz/gruvbox` README](https://github.com/morhetz/gruvbox/blob/ef8864bb42bf244f0295d1c5a403b27e3d139695/README.md) and `package.json` designate MIT/X11 (commit `ef8864bb42bf244f0295d1c5a403b27e3d139695`). The source does not define cursor or selection colors; Puzzle derives them. |
| Nord | [`nordtheme/gnome-terminal` `src/nord.sh`](https://github.com/nordtheme/gnome-terminal/blob/c15b85a5389cf3bfd37fe409e915a88ecf902640/src/nord.sh), commit `c15b85a5389cf3bfd37fe409e915a88ecf902640`, MIT; license copied to `assets/themes/licenses/Nord-MIT.txt`. |
| Tokyo Night, Tokyo Night Day | [`folke/tokyonight.nvim` Kitty extras](https://github.com/folke/tokyonight.nvim/tree/cdc07ac78467a233fd62c493de29a17e0cf2b2b6/extras/kitty), commit `cdc07ac78467a233fd62c493de29a17e0cf2b2b6`. Each Kitty theme file identifies its palette as MIT; the repository's root license is Apache-2.0, copied to `assets/themes/licenses/TokyoNight-Apache-2.0.txt`. Both designations are recorded because the file header and repository license differ. |

## Unicode property lookup

The incremental UAX #29 lookup is generated from the already-approved
`unicode-segmentation` 1.13.3 Unicode 17.0 property tables (MIT OR Apache-2.0;
Copyright The Rust Project Developers). It retains the same Unicode facts in
32,000 bytes of deduplicated lookup pages. The generator and source/version
instructions are in `crates/puzzle-vt/src/terminal/print/boundary/generate.py`.
Conformance tests read that resolved crate's existing data; no new fixture is
vendored or downloaded.

## Kitty Unicode placeholder mapping

M15.6 stores the 297 Unicode scalar values in kitty's [rowcolumn-diacritics.txt](https://sw.kovidgoyal.net/kitty/_downloads/f0a0de9ec8d9ff4456206db8e0814937/rowcolumn-diacritics.txt), which derives its fixed wire order from Unicode 6.0.0 character properties. Credit: Kovid Goyal and the kitty graphics protocol authors. Only the numerical Unicode mapping is retained, with its source and an exact-order test in `crates/puzzle-term/src/images/placeholders/`; no kitty implementation code or image assets are copied.

## Desktop thread diagnostics

The user-approved desktop diagnostic feature uses `rustix` 1.1.5
(Apache-2.0 OR Apache-2.0 WITH LLVM-exception OR MIT) for safe thread CPU
clock reads. It was already a transitive dependency. The platform-neutral
core and wasm build do not use this API. D-50 withdraws the QoS experiment;
no scheduling API is linked directly by Puzzle.

## X11 named colours

The 782-entry X.Org `rgb.txt` named-colour data and generated static lookup are
distributed under MIT/X11. Copyright The Open Group 1985, 1989, 1998 and Oracle
and/or affiliates 1994, 2008. The complete upstream licence is
`assets/colors/COPYING`; pinned source, hashes and regeneration instructions
are in `assets/colors/README.md`. Approved by the user on 2026-10-11 (R4).

## Development-only fuzzing (M19.2b; never distributed)

User-approved 2026-10-13: cargo-fuzz 0.13.2 (MIT OR Apache-2.0), installed as a
local tool; libfuzzer-sys 0.4.13 (`(MIT OR Apache-2.0) AND NCSA`, including its
bundled LLVM libFuzzer runtime) and arbitrary 1.4.2 (MIT OR Apache-2.0) in the
isolated unpublished `fuzz/` workspace. The resolved graph is pinned separately
in `fuzz/Cargo.lock`; `cc` and `jobserver` are build-time support (MIT OR
Apache-2.0). None enters a distributed native or wasm build. Source licences
ship with the registry packages; the complete resolved licence report and
source links are recorded in M19 evidence and `fuzz/README.md`.

## Crates

Generated from the locked puzzle-web WASM normal dependency graph with `release-info`.

- arrayvec v0.7.8 — MIT OR Apache-2.0
- bitflags v2.13.2 — MIT OR Apache-2.0
- bumpalo v3.20.3 — MIT OR Apache-2.0
- bytemuck v1.25.2 — Zlib OR Apache-2.0 OR MIT
- bytemuck_derive v1.12.1 (proc-macro) — Zlib OR Apache-2.0 OR MIT
- cfg-if v1.0.5 — MIT OR Apache-2.0
- console_error_panic_hook v0.1.7 — Apache-2.0/MIT
- document-features v0.2.12 (proc-macro) — MIT OR Apache-2.0
- equivalent v1.0.2 — Apache-2.0 OR MIT
- foldhash v0.2.0 — Zlib
- font-types v0.12.5 — MIT OR Apache-2.0
- futures-core v0.3.34 — MIT OR Apache-2.0
- futures-task v0.3.34 — MIT OR Apache-2.0
- futures-util v0.3.34 — MIT OR Apache-2.0
- harfrust v0.13.0 — MIT
- hashbrown v0.17.1 — MIT OR Apache-2.0
- indexmap v2.14.2 — Apache-2.0 OR MIT
- js-sys v0.3.104 — MIT OR Apache-2.0
- kurbo v0.13.1 — Apache-2.0 OR MIT
- lazy_static v1.5.0 — MIT OR Apache-2.0
- litrs v1.0.0 — MIT OR Apache-2.0
- log v0.4.34 — MIT OR Apache-2.0
- memchr v2.8.3 — Unlicense OR MIT
- naga-types v30.0.1 — MIT OR Apache-2.0
- nu-ansi-term v0.50.3 — MIT
- once_cell v1.21.4 — MIT OR Apache-2.0
- pin-project-lite v0.2.17 — Apache-2.0 OR MIT
- polycool v0.4.0 — MIT OR Apache-2.0
- proc-macro2 v1.0.107 — MIT OR Apache-2.0
- profiling v1.0.18 — MIT OR Apache-2.0
- quote v1.0.47 — MIT OR Apache-2.0
- raw-window-handle v0.6.2 — MIT OR Apache-2.0 OR Zlib
- read-fonts v0.43.3 — MIT OR Apache-2.0
- rustc-hash v1.1.0 — Apache-2.0/MIT
- rustc-hash v2.1.3 — Apache-2.0 OR MIT
- sharded-slab v0.1.7 — MIT
- skrifa v0.46.2 — MIT OR Apache-2.0
- slab v0.4.12 — MIT
- smallvec v1.16.2 — MIT OR Apache-2.0
- static_assertions v1.1.0 — MIT OR Apache-2.0
- syn v2.0.119 — MIT OR Apache-2.0
- syn v3.0.6 — MIT OR Apache-2.0
- thiserror v2.0.21 — MIT OR Apache-2.0
- thiserror-impl v2.0.21 (proc-macro) — MIT OR Apache-2.0
- thread_local v1.1.10 — MIT OR Apache-2.0
- tracing v0.1.44 — MIT
- tracing-attributes v0.1.31 (proc-macro) — MIT
- tracing-core v0.1.36 — MIT
- tracing-subscriber v0.3.23 — MIT
- tracing-web v0.1.3 — MIT OR Apache-2.0
- unicode-ident v1.0.26 — (MIT OR Apache-2.0) AND Unicode-3.0
- unicode-segmentation v1.13.3 — MIT OR Apache-2.0
- unicode-width v0.2.2 — MIT OR Apache-2.0
- vte v0.15.0 — Apache-2.0 OR MIT
- wasm-bindgen v0.2.127 — MIT OR Apache-2.0
- wasm-bindgen-futures v0.4.77 — MIT OR Apache-2.0
- wasm-bindgen-macro v0.2.127 (proc-macro) — MIT OR Apache-2.0
- wasm-bindgen-macro-support v0.2.127 — MIT OR Apache-2.0
- wasm-bindgen-shared v0.2.127 — MIT OR Apache-2.0
- web-sys v0.3.104 — MIT OR Apache-2.0
- web-time v1.1.0 — MIT OR Apache-2.0
- wgpu v30.0.1 — MIT OR Apache-2.0
- wgpu-types v30.0.1 — MIT OR Apache-2.0
