// Los JSON de reglas son grandes: los tipamos a mano (src/data/types.ts) en vez
// de dejar que TypeScript infiera su forma.
declare module '*.json' {
  const value: unknown
  export default value
}
