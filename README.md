# puzzleweb

**Live preview: https://lateshift.github.io/puzzleweb/**

The showcase site for [Puzzle Terminal](https://github.com/lateshift/puzzle-term). Its centrepiece is Future Crew's iconic 1993 demo *Second Reality*, playing live inside Puzzle in your browser. It isn't a video: every frame is ANSI escape sequences, and Puzzle parses and draws them on the GPU.

---

## Credits first

**All creative work in Second Reality belongs to Future Crew:** the code, the graphics and the music. This site didn't make the demo. It only shows it playing in a terminal.

| | |
|---|---|
| Code | Psi (Sami Tammilehto) · Trug (Mika Tuomi) · Wildfire (Arto Vuori) |
| Music | Purple Motion (Jonne Valtonen) · Skaven (Peter Hajba) |
| Graphics | Marvel (Aki Määttä) · Pixel (Mikko Iho) |
| Organizer | GORE (Samuli Syvähuoko) |
| BBS | Abyss (Jussi Laakkonen) |

In 2013 Future Crew released the [original source and data](https://github.com/mtuomi/SecondReality) under the Unlicense. Two later ports keep the demo running today:

- [SecondRealityW32](https://github.com/ConspiracyHu/SecondRealityW32) by **Gargaj / Conspiracy**;
- [SecondReality++](https://github.com/XorJS/SecondRealityPlusPlus) by **XorJS** (Unlicense), which the ANSI port builds on.

Thank you, Future Crew, for the inspiration, then and now.

The same ANSI output also plays natively in [Ghostty](https://ghostty.org). Thanks to Mitchell Hashimoto and the Ghostty contributors, whose terminal was our comparison throughout the port.

---

## What's going on on the page

```
SecondReality++  (Future Crew's demo code, compiled to WebAssembly)
      │  renders each frame into an emulated VGA framebuffer + 256-colour palette
      ▼
ANSI Second Reality  (encoder)
      │  turns every frame into escape sequences:
      │    ▀ half-blocks, two pixels per character cell, 256-colour indices,
      │    OSC 4 palette updates, only changed cells, synchronized output (mode 2026)
      ▼
Puzzle Terminal  (browser build: WebAssembly + WebGPU)
      │  parses the byte stream like any terminal output and draws the grid on the GPU
      ▼
your screen, at up to 70 frames per second, with the original music
```

- **`index.html`:** the main page.
  - The demo player has a scene picker, scale, fullscreen and a stats overlay.
  - A live line under the player shows how many bytes of ANSI Puzzle is parsing per second.
  - "What you're watching" explains the technique, and a note says it also runs in Ghostty.
  - The Puzzle feature list is old-school `*` style.
- **`plasma.html`:** a full-page plasma on a canvas. A Puzzle terminal in the middle draws *the same* plasma with C64-style block characters, so it reads as one continuous effect.
- **`credits.html`:** full credits and licence notices.

**Everything is self-hosted.** The site makes no third-party requests: no CDNs, web fonts, analytics or trackers. You need a browser with WebGPU (current Chrome, Edge or Safari). Without it, the page shows a still frame and a note.

---

## Repository layout

| Path | What |
|---|---|
| `index.html`, `plasma.html`, `credits.html` | the pages |
| `css/` | `site.css`, `plasma.css` |
| `js/showcase.js` | player page: mounting, controls, stats and the live ANSI counter |
| `js/hero-fit.js` | fits the 320×100 (or 320×175) terminal grid into the frame, including fullscreen |
| `js/plasma*.js` | plasma field, PETSCII cell mapping, canvas and terminal sync |
| `img/`, `fonts/`, `notices/` | poster images, Inter (OFL), extra licence notices |
| `build.sh` | assembles the deployable site into `_site/` |
| `preview.sh` | serves `_site/` locally under the `/puzzleweb/` subpath, like GitHub Pages does |
| `deploy.sh` | prepares a local `gh-pages` commit from `_site/` (never pushes) |

## Build, preview, deploy

`build.sh` needs two sibling checkouts, already built:

- `../puzzle-term` with its browser package in `dist/pkg` (`cargo xtask web package`);
- `../ansi-second-reality` with its web build in `build/web` (`make web`).

```sh
./build.sh      # copies the Puzzle package, the ANSI Second Reality module and the pages into _site/
./preview.sh    # http://127.0.0.1:8090/puzzleweb/
./deploy.sh     # local gh-pages commit from _site/, then prints the push command
```

`build.sh` refuses to build a site that contains symlinks, source maps or absolute local paths. It also writes `build-info.json` with the Puzzle and ANSI Second Reality commits used.

**Publishing is manual:** push the `gh-pages` branch, and set **Settings → Pages → Deploy from a branch → `gh-pages` / root**. Pages must serve `gh-pages` (the built site), not `main`, because `main` holds only the sources.

## Licences

- *Second Reality* source and data © Future Crew, released under the Unlicense (2013).
- SecondReality++ (XorJS): Unlicense.
- Puzzle Terminal: MIT, with third-party notices shipped in `_site/puzzle/`.
- Fonts: Inter and JetBrains Mono (SIL OFL), Symbols Nerd Font (its own notice).
