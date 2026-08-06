/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_METERED_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.yml' {
  const content: any;
  export default content;
}
