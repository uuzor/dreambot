// Stands in for the "server-only" package in tests. The real module throws when
// imported outside a React Server Component, which is not the context a plain
// vitest run provides.
export {};
