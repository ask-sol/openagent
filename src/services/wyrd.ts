import type { Provider } from "../providers/types.js";
import type { Tool } from "../tools/types.js";

/**
 * Opt-in tracing via the Wyrd execution debugger.
 *
 * Enable by setting `WYRD_ENABLED=1`. The wyrd module is loaded lazily so
 * OpenAgent does not require it as a runtime dependency unless tracing
 * is requested. Traces are written to `./.wyrd/traces.duckdb` (override
 * with `WYRD_DIR`).
 */

export interface WyrdSession {
  readonly enabled: boolean;
  wrapProvider<P extends Provider>(p: P): P;
  wrapTool<T extends Tool>(t: T): T;
  wrapToolLookup(
    lookup: (name: string) => Tool | undefined,
  ): (name: string) => Tool | undefined;
  run<T>(name: string, fn: () => Promise<T>): Promise<T>;
  step<T>(name: string, fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const NOOP: WyrdSession = {
  enabled: false,
  wrapProvider: <P extends Provider>(p: P): P => p,
  wrapTool: <T extends Tool>(t: T): T => t,
  wrapToolLookup: (lookup) => lookup,
  run: <T>(_name: string, fn: () => Promise<T>): Promise<T> => fn(),
  step: <T>(_name: string, fn: () => Promise<T>): Promise<T> => fn(),
  close: async () => {},
};

function tracingRequested(): boolean {
  const v = process.env.WYRD_ENABLED;
  return v === "1" || v === "true";
}

export async function createWyrdSessionIfEnabled(opts: {
  agent_id: string;
  agent_version: string;
}): Promise<WyrdSession> {
  if (!tracingRequested()) return NOOP;
  try {
    // Lazy import — wyrd is an optional, link-installed dependency.
    const integ = await import("wyrd/integrations/openagent");
    const session = await integ.createWyrdSession({
      agent_id: opts.agent_id,
      agent_version: opts.agent_version,
      sdk_version: "0.0.1",
    });
    return {
      enabled: true,
      wrapProvider: <P extends Provider>(p: P): P =>
        session.wrapProvider(p as unknown as Parameters<typeof session.wrapProvider>[0]) as unknown as P,
      wrapTool: <T extends Tool>(t: T): T =>
        session.wrapTool(t as unknown as Parameters<typeof session.wrapTool>[0]) as unknown as T,
      wrapToolLookup: (lookup) =>
        session.wrapToolLookup(
          lookup as unknown as Parameters<typeof session.wrapToolLookup>[0],
        ) as unknown as (name: string) => Tool | undefined,
      run: (name, fn) => session.run(name, fn),
      step: (name, fn) => session.step(name, fn),
      close: () => session.close(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `[wyrd] tracing requested but module unavailable (${msg}); continuing without tracing.\n`,
    );
    return NOOP;
  }
}
