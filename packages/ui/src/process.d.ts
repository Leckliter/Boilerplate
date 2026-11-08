/**
 * Components log a dev-only warning behind `process.env.NODE_ENV`. Next (and any bundler)
 * replaces it at build time; this keeps packages/ui from needing all of @types/node for one variable.
 */
declare const process: { env: { NODE_ENV?: string } };
