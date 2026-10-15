import { Cause, Data, Exit, Option } from 'effect';

// A rule the caller broke (unknown id, bad input, disabled module). Anything
// else that goes wrong is a defect and reaches the caller as `internal`.
export class DomainError extends Data.TaggedError('DomainError')<{
  readonly code: string;
  readonly message: string;
}> {}

export const domainError = (code: string, message: string) => new DomainError({ code, message });

// What crosses IPC and AI-tool boundaries: plain data, never an Error object.
export type Wire<A> =
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

export const toWire = <A>(exit: Exit.Exit<A, DomainError>): Wire<A> => {
  if (Exit.isSuccess(exit)) return { ok: true, value: exit.value };
  const failure = Cause.findErrorOption(exit.cause);
  if (Option.isSome(failure)) return { ok: false, error: { code: failure.value.code, message: failure.value.message } };
  return { ok: false, error: { code: 'internal', message: Cause.pretty(exit.cause) } };
};
