# PRISM Protocol Docs Website

This folder contains the standalone PRISM Protocol documentation website. It is
built with [Docusaurus](https://docusaurus.io/) and uses the official PRISM docs
content in `docs/`.

## What to Copy

The UI lives mainly in these files:

- `docusaurus.config.ts` - site title, navbar, footer, docs routing, Prism theme
- `src/css/custom.css` - dark theme colors, typography, navbar/footer styling
- `src/pages/index.tsx` and `src/pages/index.module.css` - optional landing page
- `static/img/` - logo, favicon, and image assets
- `sidebars.ts` - docs sidebar structure

The `docs/` directory contains the public protocol documentation: architecture,
financial model, operations, market design, controls, compliance posture, and
roadmap.

## Installation

```bash
npm install
```

## Local Development

```bash
npm run start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

## Build

```bash
npm run build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.
