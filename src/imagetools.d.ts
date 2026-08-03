/// <reference types="vite/client" />
/// <reference types="vite-imagetools/client" />

// vite-imagetools emits transformed assets from query-suffixed imports; declare
// the shapes we use so TypeScript resolves them like ordinary asset imports.
declare module "*?w=480&format=webp" {
  const src: string;
  export default src;
}

declare module "*?w=192&format=webp" {
  const src: string;
  export default src;
}
