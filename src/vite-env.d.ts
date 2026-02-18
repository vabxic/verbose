/// <reference types="vite/client" />
import type React from 'react';

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'spline-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        url?: string;
        color?: unknown;
        amplitude?: unknown;
        distance?: unknown;
        enableMouseInteraction?: unknown;
      };
    }
  }
}

export {};
