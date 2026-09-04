/**
 * Superfície pública do pacote de recolha.
 *
 * Existe para que o backoffice possa correr uma fonte à mão sem duplicar a
 * lógica do CLI.
 */

export * from './adapter.js';
export * from './adapters/index.js';
export * from './db.js';
export * from './html.js';
export * from './http.js';
export * from './pipeline.js';
export * from './run-logger.js';
