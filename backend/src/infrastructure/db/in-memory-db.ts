import crypto from 'crypto';

function matchesCondition(item: any, cond: any): boolean {
  if (!cond) return true;
  if (typeof cond === 'object') {
    const colName = cond.left?.name || cond.left?.columnName || cond.left?.property || cond.column?.name;
    const targetVal = cond.right;
    if (colName && targetVal !== undefined) {
      const camelName = colName.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase());
      const valInItem = item[camelName] !== undefined ? item[camelName] : item[colName];
      return valInItem === targetVal;
    }
  }
  return true;
}

function getTableName(table: any): string {
  if (typeof table === 'string') return table;
  if (!table || typeof table !== 'object') return '';

  const symbolKeys = Object.getOwnPropertySymbols(table);
  for (const sym of symbolKeys) {
    if (sym.toString().includes('Name')) {
      const val = table[sym];
      if (typeof val === 'string' && val) return val;
    }
  }

  const possibleNames = [
    table._?.name,
    table._?.config?.name,
    table.tableName,
    table.name,
  ];

  for (const n of possibleNames) {
    if (typeof n === 'string' && n) return n;
  }

  return '';
}

export function createInMemoryDb() {
  const store: Record<string, any[]> = {
    projects: [],
    tasks: [],
    runs: [],
    run_steps: [],
    test_cases: [],
    test_results: [],
    issues: [],
    browser_sessions: [],
    evidence: [],
  };

  const mapTableName = (tableObj: any): string => {
    const nameStr = getTableName(tableObj);
    const normalized = nameStr.toLowerCase();

    if (normalized.includes('project')) return 'projects';
    if (normalized.includes('task')) return 'tasks';
    if (normalized.includes('run_step') || normalized.includes('runstep')) return 'run_steps';
    if (normalized.includes('run')) return 'runs';
    if (normalized.includes('test_case') || normalized.includes('testcase')) return 'test_cases';
    if (normalized.includes('test_result') || normalized.includes('testresult')) return 'test_results';
    if (normalized.includes('issue')) return 'issues';
    if (normalized.includes('browser_session') || normalized.includes('browsersession')) return 'browser_sessions';
    if (normalized.includes('evidence')) return 'evidence';

    return normalized || 'projects';
  };

  const populateWithRelations = (item: any, tableKey: string, withConfig: any) => {
    if (!item || !withConfig) return item;
    const clone = { ...item };

    if (tableKey === 'runs') {
      if (withConfig.testResults) {
        clone.testResults = store.test_results.filter(tr => tr.runId === item.id);
      }
      if (withConfig.issues) {
        clone.issues = store.issues.filter(i => i.runId === item.id);
      }
      if (withConfig.evidence) {
        clone.evidence = store.evidence.filter(e => e.runId === item.id);
      }
      if (withConfig.browserSessions) {
        clone.browserSessions = store.browser_sessions.filter(bs => bs.runId === item.id);
      }
    }
    return clone;
  };

  const buildQueryApi = (tableKey: string) => {
    return {
      findFirst: async (options?: any) => {
        const list = store[tableKey] || [];
        let filtered = list.filter(item => matchesCondition(item, options?.where));
        if (options?.orderBy) {
          filtered = [...filtered].reverse();
        }
        const item = filtered[0];
        return item ? populateWithRelations(item, tableKey, options?.with) : null;
      },
      findMany: async (options?: any) => {
        const list = store[tableKey] || [];
        let filtered = list.filter(item => matchesCondition(item, options?.where));
        if (options?.orderBy) {
          filtered = [...filtered].reverse();
        }
        return filtered.map(item => populateWithRelations(item, tableKey, options?.with));
      }
    };
  };

  const inMemoryDb: any = {
    insert: (table: any) => {
      const rawName = mapTableName(table);
      return {
        values: (input: any) => {
          const itemsToInsert = Array.isArray(input) ? input : [input];
          const inserted: any[] = [];
          const list = store[rawName] || (store[rawName] = []);

          for (const item of itemsToInsert) {
            const newItem = {
              id: item.id || crypto.randomUUID(),
              createdAt: item.createdAt || new Date(),
              updatedAt: item.updatedAt || new Date(),
              ...item,
            };

            if ((rawName === 'runs' || rawName === 'browser_sessions') && !newItem.startedAt) {
              newItem.startedAt = newItem.createdAt || new Date();
            }

            list.push(newItem);
            inserted.push(newItem);
          }

          const promise: any = Promise.resolve(inserted);
          promise.returning = async () => inserted;
          return promise;
        }
      };
    },

    update: (table: any) => {
      const rawName = mapTableName(table);
      return {
        set: (updateData: any) => {
          return {
            where: async (condition: any) => {
              const list = store[rawName] || [];
              const updated: any[] = [];
              for (const item of list) {
                if (matchesCondition(item, condition)) {
                  Object.assign(item, updateData, { updatedAt: new Date() });
                  updated.push(item);
                }
              }
              return updated;
            }
          };
        }
      };
    },

    select: () => {
      return {
        from: (table: any) => {
          const rawName = mapTableName(table);
          const queryObj: any = {
            whereCondition: null,
            limitVal: null,
            where(cond: any) {
              queryObj.whereCondition = cond;
              return queryObj;
            },
            orderBy() {
              return queryObj;
            },
            limit(n: number) {
              queryObj.limitVal = n;
              return queryObj;
            },
            then(resolve: any, reject: any) {
              try {
                const list = store[rawName] || [];
                let res = list.filter(item => matchesCondition(item, queryObj.whereCondition));
                if (queryObj.limitVal !== null) {
                  res = res.slice(0, queryObj.limitVal);
                }
                resolve(res);
              } catch (err) {
                reject(err);
              }
            }
          };
          return queryObj;
        }
      };
    },

    query: {
      projects: buildQueryApi('projects'),
      tasks: buildQueryApi('tasks'),
      runs: buildQueryApi('runs'),
      runSteps: buildQueryApi('run_steps'),
      testCases: buildQueryApi('test_cases'),
      testResults: buildQueryApi('test_results'),
      issues: buildQueryApi('issues'),
      browserSessions: buildQueryApi('browser_sessions'),
      evidence: buildQueryApi('evidence'),
    },

    execute: async () => {
      return { rows: [] };
    },

    transaction: async (cb: any) => {
      return await cb(inMemoryDb);
    }
  };

  return inMemoryDb;
}
