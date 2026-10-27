// Seeded violation: reads a DOM global at module scope. Importing this under the default
// jsdom-free environment must throw (ADR-002). It lives outside src/ so it is never built.
declare const document: { title: string };
export const title = document.title;
