/**
 * Client-safe engine identity.
 *
 * The engine itself is server-only, but browser surfaces need to compare the
 * version that produced a stored score against the version running today in
 * order to say "this was assessed by an older engine". Keeping the constants
 * here means no UI file imports a `.server` module to read a string.
 */
export const ENGINE_VERSION = "taasflow-scoring-v1.2.0";
