import type { DatabaseSync } from 'node:sqlite';
import { jobsTableSql } from './scheduler';

// Vite strips the `node:` prefix from imports it does not know, so load the
// built-in through Node directly.
export const memoryDb = (...migrations: string[]): DatabaseSync => {
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  for (const sql of [jobsTableSql, ...migrations]) db.exec(sql);
  return db;
};

export const START = Date.parse('2026-10-15T09:00:00+09:00');
