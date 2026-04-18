/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BUILD_LABEL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
