# Stillframe

An interactive film-camera experience built with Vite and Three.js: animated waist-level finder, film-advance interaction, synchronized landscape video, mechanical shutter transition and PBR materials.

## Run locally

Requires Node.js 22 or later.

```sh
npm ci
npm run dev
```

## Build and publish

```sh
npm run build
```

The production site is generated in `dist/`. Relative asset URLs support GitHub Pages project subdirectories. The GitHub Actions workflow in `.github/workflows/deploy-pages.yml` builds and deploys pushes to `main`. Configure repository Pages to use GitHub Actions.

## Interaction

- Drag the camera to orbit, including a vertical overhead view.
- Open/close the finder with the first circular control. Its video display is hidden while closed.
- Advance film with the second control or choose a scene card.
- Reset with the third control.

## Media and attribution

Third-party video, real camera recordings and CC0 leather textures have separate license terms. See [media sources and attribution](public/media-sources.md). Public source availability does not change those licenses or imply that every asset is CC0. No blanket software license is granted by this README.
