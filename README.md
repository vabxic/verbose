# Verbose 

This project is a small React + TypeScript + Vite app that showcases a glowing orb background, a gooey navigation menu, and an animated "decrypted" hero title:

- Orb background with hover/rotation effects (three‑dimensional feel)
- Gooey navigation bar with particle transitions between items
- Decrypted text animation for the main headline
- UI components built on `@jamsr-ui/react` and Tailwind CSS

Use it as a landing hero, background experiment, or as a starting point for more complex UIs.

---

## Tech Stack

- React 19 + React DOM
- TypeScript
- Vite 5
- Tailwind CSS 4 (via `@tailwindcss/postcss`)
- `@jamsr-ui/react` for buttons, header, and typography
- `motion` and `ogl` for visual/orb effects

---

## Getting Started

### Prerequisites

- Node.js **18+** (recommended for Vite 5)
- A package manager:
  - Recommended: **pnpm** (a `pnpm-lock.yaml` is included)
  - Also works with npm or yarn (adjust commands accordingly)

### Install Dependencies

Using **pnpm** (recommended):

```bash
pnpm install
```

Using **npm**:

```bash
npm install
```

Using **yarn**:

```bash
yarn install
```

### Run the Development Server

```bash
pnpm dev
```

Then open the printed URL (by default `http://localhost:5173`) in your browser.

### Build for Production

```bash
pnpm build
```

This runs TypeScript checks (`tsc -b`) and then creates an optimized production build in the `dist` folder.

### Preview the Production Build

```bash
pnpm preview
```

This serves the contents of `dist` with Vite's preview server.

### Lint the Code

```bash
pnpm lint
```

This runs ESLint on the project.

---

## Project Structure (Relevant Parts)

- `src/main.tsx` – React entry point that mounts the app
- `src/App.tsx` – Main layout: header, gooey nav, orb background, hero text and buttons
- `src/components/Orb.tsx` – Orb background and hover/rotation logic
- `src/components/GooeyNav.tsx` – Gooey navigation with particle effects
- `src/components/GooeyNav.css` – Styles for the gooey nav/particle filter
- `src/components/DecryptedText.tsx` – Decrypted/typing style animation for the hero heading
- `src/components/Logo.tsx` – App/brand logo component
- `src/index.css` – Global styles and Tailwind entry

---

## Customization

### Hero Text & Buttons

Edit `src/App.tsx`:

- Change the hero message by updating the `text` prop on `DecryptedText`:
  - `text="Talk more, With Verbose"`
- Tweak animation via props: `speed`, `maxIterations`, `sequential`, `revealDirection`, `animateOn`.
- Update the primary/secondary CTA labels on the two `Button` components.

### Gooey Navigation Items

Also in `src/App.tsx`, adjust the `items` passed to `GooeyNav`:

```ts
<GooeyNav
  items=[
    { label: "Home", href: "#" },
    { label: "Docs", href: "#" },
    { label: "Contact", href: "#" },
  ]
/>
```

- Change labels and `href`s to fit your sections/routes.
- Advanced behavior (animation time, particle count etc.) can be tuned via optional `GooeyNav` props: `animationTime`, `particleCount`, `particleDistances`, `particleR`, `timeVariance`, `colors`, and `initialActiveIndex`.

### Orb Behavior

`Orb` accepts several props (see `src/components/Orb.tsx`):

- `hoverIntensity` – how strongly the orb reacts to hover
- `rotateOnHover` – enable/disable rotation
- `hue` – base color hue
- `forceHoverState` – force the hover effect on/off

Adjust these to match your brand style and motion preferences.

---

## Scripts Reference

All scripts are defined in `package.json`:

- `pnpm dev` – Start Vite dev server
- `pnpm build` – Type-check and build for production
- `pnpm preview` – Preview the production build
- `pnpm lint` – Run ESLint over the project

---

## Deploying

After running `pnpm build`, deploy the contents of the `dist` folder to any static hosting provider (Netlify, Vercel, GitHub Pages, Cloudflare Pages, etc.). The app is a purely client-side SPA built with Vite.

