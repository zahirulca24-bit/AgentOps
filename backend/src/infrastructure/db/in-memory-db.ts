import crypto from 'crypto';

function matchesCondition(item: any, cond: any): boolean {
  if (!cond) return true;
  if (typeof cond === 'boolean') return cond;
  if (typeof cond === 'function') {
    const fnResult = cond(item);
    if (typeof fnResult === 'boolean') return fnResult;
    return matchesCondition(item, fnResult);
  }
  if (typeof cond === 'object') {
    if (Array.isArray(cond)) {
      return cond.every(c => matchesCondition(item, c));
    }
    if (Array.isArray(cond.conditions)) {
      return cond.conditions.every((c: any) => matchesCondition(item, c));
    }

    let colObj = cond.left || cond.column || cond.config?.left;
    let targetVal = cond.right !== undefined ? cond.right : (cond.value !== undefined ? cond.value : cond.config?.right);

    if (!colObj && Array.isArray(cond.queryChunks)) {
      colObj = cond.queryChunks.find((chunk: any) => chunk && (chunk.name || chunk.columnName || chunk.key || chunk.config?.name));
      const paramChunk = cond.queryChunks.find((chunk: any) => 
        chunk && (
          chunk.constructor?.name === 'Param' || 
          'encoder' in chunk || 
          ('value' in chunk && !Array.isArray(chunk.value) && typeof chunk.value !== 'object' && chunk.value !== ' = ' && chunk.value !== '=')
        )
      );
      if (paramChunk) targetVal = paramChunk;
    }

    const colName = typeof colObj === 'string' ? colObj : (colObj?.name || colObj?.columnName || colObj?.property || colObj?.key);

    while (targetVal !== undefined && targetVal !== null && typeof targetVal === 'object') {
      if ('value' in targetVal) {
        targetVal = targetVal.value;
      } else if (Array.isArray(targetVal.queryChunks) && targetVal.queryChunks.length > 0) {
        targetVal = targetVal.queryChunks[0]?.value ?? targetVal.queryChunks[0];
      } else {
        break;
      }
    }

    if (colName) {
      const camelName = colName.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase());
      const valInItem = item[camelName] !== undefined ? item[camelName] : item[colName];
      return valInItem === targetVal;
    }
    return false;
  }
  return false;
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
    github_configs: [],
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
    if (normalized.includes('github')) return 'github_configs';

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
    if (tableKey === 'issues') {
      if (withConfig.run) {
        clone.run = store.runs.find(r => r.id === item.runId) || null;
      }
      if (withConfig.testResult) {
        clone.testResult = store.test_results.find(tr => tr.id === item.testResultId) || null;
      }
      if (withConfig.browserSession) {
        clone.browserSession = store.browser_sessions.find(bs => bs.id === item.browserSessionId) || null;
      }
      if (withConfig.evidence) {
        clone.evidence = store.evidence.filter(e => e.issueId === item.id || (item.runId && e.runId === item.runId));
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
      githubConfigs: buildQueryApi('github_configs'),
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
