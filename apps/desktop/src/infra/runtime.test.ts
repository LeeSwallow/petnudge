import { expect, it, vi } from 'vitest';
import { emit } from '../core/events';
import { defineModule } from '../core/module';
import { memoryDb } from '../core/testing';
import { startEngine } from './runtime';

it('starts the engine on a database and answers over plain data', async () => {
  const engine = await startEngine(memoryDb(), []);
  expect(await engine.dispatch('todo/create', {})).toEqual({ ok: false, error: { code: 'unknown_type', message: 'Unknown todo/create' } });
  await engine.wake('resume');
  await engine.dispose();
});

it('delivers the boot catch-up of missed jobs to the host listener', async () => {
  const db = memoryDb();
  db.prepare("INSERT INTO jobs (id, kind, payload, due_at, owner, created_at) VALUES ('j', 'ping', 'null', ?, NULL, 0)").run(
    Date.now() - 3 * 60 * 60_000
  );
  const pinger = defineModule({ id: 'pinger', schedules: { ping: () => emit('pinged') } });
  const seen: string[] = [];
  const engine = await startEngine(db, [pinger], (event) => seen.push(event.type));
  await vi.waitFor(() => expect(seen).toEqual(['pinged', 'scheduler/caught-up']));
  await engine.dispose();
});
