import pg from "pg";

const CONNECTION_TIMEOUT_MS = 3_000;

// Pool o cliente de transacción. Los repositorios reciben cualquiera de los dos sin cambiar su firma.
export type Executor = pg.Pool | pg.PoolClient;

type AfterCommitHook = () => void | Promise<void>;

// Hooks registrados por cada transacción en curso. Solo existen mientras dura `withTransaction`.
const hooksPorTransaccion = new WeakMap<pg.PoolClient, AfterCommitHook[]>();

export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  });
}

export async function checkDatabase(pool: pg.Pool): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

// Ejecuta `fn` dentro de una transacción. Confirma si `fn` termina bien y revierte si lanza un error.
// Los hooks de `afterCommit` se ejecutan solo después del COMMIT, en el orden en que se registraron.
export async function withTransaction<T>(
  pool: pg.Pool,
  fn: (tx: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  const hooks: AfterCommitHook[] = [];
  hooksPorTransaccion.set(client, hooks);

  let resultado: T;
  let errorDeRollback: Error | undefined;
  try {
    await client.query("BEGIN");
    resultado = await fn(client);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch((rollbackErr: unknown) => {
      errorDeRollback = rollbackErr instanceof Error ? rollbackErr : new Error(String(rollbackErr));
    });
    throw err;
  } finally {
    hooksPorTransaccion.delete(client);
    // Si el ROLLBACK falla, la conexión no se devuelve sana al pool.
    client.release(errorDeRollback);
  }

  for (const hook of hooks) {
    await hook();
  }
  return resultado;
}

// Registra un efecto que solo debe ocurrir si la transacción confirma (por ejemplo, emitir SSE).
export function afterCommit(tx: pg.PoolClient, hook: AfterCommitHook): void {
  const hooks = hooksPorTransaccion.get(tx);
  if (!hooks) {
    throw new Error("afterCommit solo puede registrarse dentro de withTransaction");
  }
  hooks.push(hook);
}
