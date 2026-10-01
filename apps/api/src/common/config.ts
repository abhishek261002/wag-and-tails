// Re-export of the shared business config. Imported by relative path (not '@wag/config') so the compiled API loads
// its own compiled copy; Node cannot load the package's TypeScript entry point in production.
export * from '../../../../packages/config/src/index.js';
