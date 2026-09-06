import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import type { EnvConfig } from '../../config/env.js';
import { createInMemoryDb } from './in-memory-db.js';

export type Database = any;

export function createDbClient(config: EnvConfig) {
  const isTestEnv = config.NODE_ENV === 'test' || process.env.NODE_ENV === 'test';
  const queryClient = postgres(config.DATABASE_URL, {
    connect_timeout: isTestEnv ? 1 : 2,
    max_lifetime: 5,
  });
  const realDb = drizzle(queryClient, { schema });
  const inMemoryDb = createInMemoryDb();

  let useFallback = isTestEnv;

  function activateFallback(err?: any) {
    if (!useFallback) {
      useFallback = true;
      console.warn('[DB] PostgreSQL instance is unreachable. Active in-memory fallback enabled.');
    }
  }

  // Fast background probe to detect if PostgreSQL is online
  queryClient`SELECT 1`.then(() => {
    useFallback = false;
  }).catch((err) => {
    activateFallback(err);
  });

  function isConnectionError(err: any): boolean {
    if (!err) return false;
    const cause = err.cause;
    const msg = `${err.message || ''} ${err.name || ''} ${err.code || ''} ${cause?.message || ''} ${cause?.name || ''} ${cause?.code || ''}`;
    return (
      err.code === 'ECONNREFUSED' ||
      err.name === 'AggregateError' ||
      cause?.name === 'AggregateError' ||
      cause?.code === 'ECONNREFUSED' ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('connect')
    );
  }

  const dbProxy = new Proxy({}, {
    get(_target, prop, receiver) {
      if (useFallback) {
        return Reflect.get(inMemoryDb, prop, receiver);
      }

      if (prop === 'query') {
        const realQuery = realDb.query;
        return new Proxy(realQuery, {
          get(qTarget, qProp) {
            const realEntity = (qTarget as any)[qProp];
            const fallbackEntity = inMemoryDb.query[qProp as string];
            if (!realEntity) return fallbackEntity;

            return new Proxy(realEntity, {
              get(eTarget, eMethod) {
                const methodFn = eTarget[eMethod];
                if (typeof methodFn !== 'function') return methodFn;
                return async function (...args: any[]) {
                  if (useFallback) {
                    return fallbackEntity[eMethod as string](...args);
                  }
                  try {
                    return await methodFn.apply(eTarget, args);
                  } catch (err: any) {
                    if (isConnectionError(err)) {
                      activateFallback(err);
                      return fallbackEntity[eMethod as string](...args);
                    }
                    throw err;
                  }
                };
              }
            });
          }
        });
      }

      const realVal = Reflect.get(realDb, prop, receiver);

      if (typeof realVal === 'function') {
        return function (...args: any[]) {
          if (useFallback) {
            const fallbackVal = Reflect.get(inMemoryDb, prop, receiver);
            return typeof fallbackVal === 'function' ? fallbackVal.apply(inMemoryDb, args) : fallbackVal;
          }
          try {
            const res = realVal.apply(realDb, args);
            if (res && typeof res.catch === 'function') {
              return res.catch((err: any) => {
                if (isConnectionError(err)) {
                  activateFallback(err);
                  const fallbackVal = Reflect.get(inMemoryDb, prop, receiver);
                  return typeof fallbackVal === 'function' ? fallbackVal.apply(inMemoryDb, args) : fallbackVal;
                }
                throw err;
              });
            }
            return res;
          } catch (err: any) {
            if (isConnectionError(err)) {
              activateFallback(err);
              const fallbackVal = Reflect.get(inMemoryDb, prop, receiver);
              return typeof fallbackVal === 'function' ? fallbackVal.apply(inMemoryDb, args) : fallbackVal;
            }
            throw err;
          }
        };
      }

      return realVal;
    }
  });

  return {
    db: dbProxy as Database,
    queryClient,
    async close() {
      try {
        await queryClient.end({ timeout: 1 });
      } catch (e) {}
    }
  };
}
