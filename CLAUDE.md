# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 16.1.1 application built with React 19, TypeScript, and Tailwind CSS v4 for video transcription functionality. The project uses the App Router architecture and is configured with shadcn/ui components using the "base-vega" style.

## Development Commands

### Running the Application
```bash
npm run dev          # Start development server at http://localhost:3000
npm run build        # Build production bundle
npm start            # Start production server
npm run lint         # Run ESLint (currently configured but command may need files specified)
```

### Installing Dependencies
```bash
npm install          # Install all dependencies
```

## Architecture

### Next.js App Router Structure
- Uses Next.js App Router (not Pages Router)
- Main entry point: `app/page.tsx` which renders `<ComponentExample />`
- Layout configuration: `app/layout.tsx` with font setup (Geist Sans, Geist Mono, Raleway)
- Global styles: `app/globals.css` using Tailwind CSS v4 with inline @theme configuration

### Styling System
- **Tailwind CSS v4**: Uses modern CSS-first approach with `@import "tailwindcss"` instead of traditional config files
- **No tailwind.config.ts**: Configuration is done inline in `app/globals.css` using `@theme inline` directive
- **Theme**: Uses OKLCH color space for better color precision
- **Dark mode**: Configured with custom variant `@custom-variant dark (&:is(.dark *))`
- **CSS Variables**: All design tokens defined as CSS custom properties in `:root` and `.dark`
- **Animations**: `tw-animate-css` package integrated for animation utilities

### Component System
- **shadcn/ui**: Configured with "base-vega" style, using Base UI React primitives
- **Icon Library**: Hugeicons (@hugeicons/react)
- **Components location**: `components/ui/` for reusable UI primitives
- **Utility function**: `lib/utils.ts` exports `cn()` helper for className merging (clsx + tailwind-merge)

### Path Aliases
All paths use `@/*` aliasing (defined in `tsconfig.json` and `components.json`):
```typescript
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
```

Standard aliases:
- `@/components` → components directory
- `@/lib` → lib directory
- `@/hooks` → hooks directory
- `@/components/ui` → UI components

### TypeScript Configuration
- Target: ES2017
- Strict mode enabled
- JSX: react-jsx (new JSX transform)
- Module resolution: bundler
- Incremental compilation enabled

## Key Technologies

- **Next.js 16.1.1** with App Router
- **React 19.2.3** (React 19 stable)
- **TypeScript 5**
- **Tailwind CSS v4** (@tailwindcss/postcss)
- **shadcn/ui** with Base UI React primitives
- **class-variance-authority** for component variant handling
- **Geist fonts** (Geist Sans, Geist Mono) via next/font

## Important Notes

### Tailwind CSS v4 Differences
This project uses Tailwind CSS v4 which has significant differences from v3:
- No `tailwind.config.js/ts` file - configuration is in CSS using `@theme inline`
- PostCSS setup uses `@tailwindcss/postcss`
- Custom properties declared in `@theme inline` block in `app/globals.css`
- Radius values use calculated variants (sm, md, lg, xl, 2xl, 3xl, 4xl)

### shadcn/ui Configuration
- Style: "base-vega" (uses Base UI React instead of Radix UI)
- RSC (React Server Components) enabled
- CSS variables mode enabled
- Base color: zinc
- Radius: 0 (sharp corners by default)
- Menu style: default with subtle accent

### Font Setup
Three fonts configured in `app/layout.tsx`:
- Raleway: Main sans font (--font-sans)
- Geist Sans: Additional sans font (--font-geist-sans)
- Geist Mono: Monospace font (--font-geist-mono)

Primary font applied to html element via Raleway variable class.
