import { expect, it } from 'vitest';
import { memoryDb } from '../core/testing';
import { startEngine } from './runtime';

it('starts the engine on a database and answers over plain data', async () => {
  const engine = await startEngine(memoryDb(), []);
  expect(await engine.dispatch('todo/create', {})).toEqual({ ok: false, error: { code: 'unknown_type', message: 'Unknown todo/create' } });
  await engine.wake('resume');
  await engine.dispose();
});
