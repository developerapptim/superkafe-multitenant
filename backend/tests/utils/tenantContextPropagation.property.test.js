const fc = require('fast-check');
const { setTenantContext, getTenantContext, runWithTenantContext } = require('../../utils/tenantContext');

/**
 * Property-Based Tests for Tenant Context Propagation
 * 
 * Feature: unified-nexus-architecture
 * Property 7: Tenant Context Propagation
 * 
 * **Validates: Requirements 2.4, 2.6**
 * 
 * For any async operation chain initiated within a request with tenant context,
 * the tenant context SHALL remain accessible via `getTenantContext()` throughout
 * the entire async execution chain without explicit parameter passing.
 * 
 * This test verifies that:
 * - Tenant context propagates through nested async function calls
 * - Context remains accessible after Promise.all() operations
 * - Context persists through setTimeout/setImmediate
 * - Multiple concurrent contexts remain isolated from each other
 * - Context survives through deep async call chains
 */

// Helper: Generate valid MongoDB ObjectId hex string (24 hex characters)
const objectIdArbitrary = () => 
  fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 24, maxLength: 24 })
    .map(arr => arr.map(n => n.toString(16)).join(''));

// Helper: Generate tenant slug
const tenantSlugArbitrary = () =>
  fc.stringMatching(/^[a-z0-9-]{3,20}$/);

// Helper: Generate tenant context
const tenantContextArbitrary = () =>
  fc.record({
    id: objectIdArbitrary(),
    slug: tenantSlugArbitrary(),
    name: fc.string({ minLength: 3, maxLength: 50 }),
    dbName: fc.constant('superkafe_v2')
  });

describe('Property 7: Tenant Context Propagation', () => {
  beforeEach(() => {
    // Clear module cache to reset fallback context
    jest.resetModules();
  });

  /**
   * Property 7.1: Context propagates through nested async function calls
   * 
   * For any tenant context and any depth of nested async calls,
   * the context must remain accessible at all levels.
   */
  test('should propagate context through nested async function calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantContextArbitrary(),
        fc.integer({ min: 1, max: 10 }), // nesting depth
        async (tenant, depth) => {
          // Create nested async function chain
          const createNestedCall = (currentDepth) => {
            return async () => {
              // Simulate async operation
              await new Promise(resolve => setImmediate(resolve));
              
              const context = getTenantContext();
              
              if (currentDepth > 1) {
                // Recurse deeper
                const nestedResult = await createNestedCall(currentDepth - 1)();
                return context && nestedResult;
              }
              
              return context !== undefined && 
                     context.id === tenant.id &&
                     context.slug === tenant.slug;
            };
          };
          
          const result = await runWithTenantContext(tenant, createNestedCall(depth));
          return result === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.2: Context remains accessible after Promise.all() operations
   * 
   * For any tenant context and any number of concurrent async operations,
   * the context must remain accessible in all parallel branches.
   */
  test('should maintain context across Promise.all() operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantContextArbitrary(),
        fc.integer({ min: 2, max: 10 }), // number of parallel operations
        async (tenant, parallelCount) => {
          const result = await runWithTenantContext(tenant, async () => {
            // Create multiple parallel async operations
            const operations = Array.from({ length: parallelCount }, (_, i) => 
              (async () => {
                // Simulate async work with varying delays
                await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
                
                const context = getTenantContext();
                return context !== undefined &&
                       context.id === tenant.id &&
                       context.slug === tenant.slug;
              })()
            );
            
            const results = await Promise.all(operations);
            
            // All parallel operations should have access to context
            return results.every(r => r === true);
          });
          
          return result === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.3: Context persists through setTimeout/setImmediate
   * 
   * For any tenant context, the context must remain accessible
   * even after async scheduling primitives like setTimeout.
   */
  test('should persist context through setTimeout and setImmediate', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantContextArbitrary(),
        fc.constantFrom('setTimeout', 'setImmediate'),
        fc.integer({ min: 0, max: 50 }), // delay in ms
        async (tenant, schedulerType, delay) => {
          const result = await runWithTenantContext(tenant, async () => {
            // Test context before scheduling
            const contextBefore = getTenantContext();
            
            // Schedule async operation
            const contextAfter = await new Promise((resolve) => {
              if (schedulerType === 'setTimeout') {
                setTimeout(() => {
                  resolve(getTenantContext());
                }, delay);
              } else {
                setImmediate(() => {
                  resolve(getTenantContext());
                });
              }
            });
            
            return contextBefore !== undefined &&
                   contextAfter !== undefined &&
                   contextBefore.id === tenant.id &&
                   contextAfter.id === tenant.id &&
                   contextBefore.slug === tenant.slug &&
                   contextAfter.slug === tenant.slug;
          });
          
          return result === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.4: Multiple concurrent contexts remain isolated
   * 
   * For any set of different tenant contexts executing concurrently,
   * each execution chain must maintain its own isolated context.
   */
  test('should isolate contexts between concurrent tenant operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }), // number of tenants
        async (tenantCount) => {
          // Generate unique tenants with different IDs
          const uniqueTenants = Array.from({ length: tenantCount }, (_, i) => ({
            id: `${i.toString().padStart(24, '0')}`,
            slug: `tenant-${i}`,
            name: `Tenant ${i}`,
            dbName: 'superkafe_v2'
          }));
          
          // Execute concurrent operations for each tenant
          const results = await Promise.all(
            uniqueTenants.map(tenant =>
              runWithTenantContext(tenant, async () => {
                // Simulate async work
                await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
                
                // Verify context matches this tenant
                const context = getTenantContext();
                
                // Nested async call to verify propagation
                await new Promise(resolve => setImmediate(resolve));
                const nestedContext = getTenantContext();
                
                return context !== undefined &&
                       nestedContext !== undefined &&
                       context.id === tenant.id &&
                       nestedContext.id === tenant.id &&
                       context.slug === tenant.slug &&
                       nestedContext.slug === tenant.slug;
              })
            )
          );
          
          // All concurrent operations should have maintained their own context
          return results.every(r => r === true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.5: Context survives through deep async call chains
   * 
   * For any tenant context and any complex async operation pattern,
   * the context must remain accessible throughout the entire chain.
   */
  test('should maintain context through complex async operation chains', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantContextArbitrary(),
        fc.integer({ min: 2, max: 5 }), // number of sequential operations
        fc.integer({ min: 2, max: 4 }), // number of parallel operations per step
        async (tenant, sequentialSteps, parallelOpsPerStep) => {
          const result = await runWithTenantContext(tenant, async () => {
            const contextChecks = [];
            
            // Sequential steps
            for (let step = 0; step < sequentialSteps; step++) {
              // Parallel operations within each step
              const stepResults = await Promise.all(
                Array.from({ length: parallelOpsPerStep }, async () => {
                  // Nested async operations
                  await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
                  const context1 = getTenantContext();
                  
                  await new Promise(resolve => setImmediate(resolve));
                  const context2 = getTenantContext();
                  
                  return context1 !== undefined &&
                         context2 !== undefined &&
                         context1.id === tenant.id &&
                         context2.id === tenant.id;
                })
              );
              
              contextChecks.push(...stepResults);
            }
            
            // Final context check
            const finalContext = getTenantContext();
            contextChecks.push(
              finalContext !== undefined &&
              finalContext.id === tenant.id &&
              finalContext.slug === tenant.slug
            );
            
            return contextChecks.every(check => check === true);
          });
          
          return result === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.6: Context propagates through Promise chains
   * 
   * For any tenant context and any Promise chain (.then().then()...),
   * the context must remain accessible in all chain links.
   */
  test('should propagate context through Promise chains', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantContextArbitrary(),
        fc.integer({ min: 2, max: 8 }), // chain length
        async (tenant, chainLength) => {
          const result = await runWithTenantContext(tenant, async () => {
            let promise = Promise.resolve(true);
            
            // Build Promise chain
            for (let i = 0; i < chainLength; i++) {
              promise = promise.then(async (prevResult) => {
                await new Promise(resolve => setTimeout(resolve, 1));
                const context = getTenantContext();
                
                return prevResult &&
                       context !== undefined &&
                       context.id === tenant.id &&
                       context.slug === tenant.slug;
              });
            }
            
            return await promise;
          });
          
          return result === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.7: Context accessible in error handling paths
   * 
   * For any tenant context, the context must remain accessible
   * even in error handling (catch blocks).
   */
  test('should maintain context in error handling paths', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantContextArbitrary(),
        fc.boolean(), // whether to throw error
        async (tenant, shouldThrow) => {
          const result = await runWithTenantContext(tenant, async () => {
            try {
              await new Promise(resolve => setImmediate(resolve));
              const contextInTry = getTenantContext();
              
              if (shouldThrow) {
                throw new Error('Test error');
              }
              
              return contextInTry !== undefined &&
                     contextInTry.id === tenant.id;
            } catch (error) {
              // Context should still be accessible in catch block
              const contextInCatch = getTenantContext();
              
              return contextInCatch !== undefined &&
                     contextInCatch.id === tenant.id &&
                     contextInCatch.slug === tenant.slug;
            }
          });
          
          return result === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.8: Context propagates through async/await patterns
   * 
   * For any tenant context and any async/await operation sequence,
   * the context must remain accessible after each await.
   */
  test('should propagate context through async/await patterns', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantContextArbitrary(),
        fc.integer({ min: 3, max: 8 }), // number of await operations
        async (tenant, awaitCount) => {
          const result = await runWithTenantContext(tenant, async () => {
            const contextChecks = [];
            
            for (let i = 0; i < awaitCount; i++) {
              // Simulate various async operations with shorter delays
              await new Promise(resolve => setTimeout(resolve, Math.random() * 2));
              const context = getTenantContext();
              
              contextChecks.push(
                context !== undefined &&
                context.id === tenant.id &&
                context.slug === tenant.slug
              );
            }
            
            return contextChecks.every(check => check === true);
          });
          
          return result === true;
        }
      ),
      { numRuns: 50 }
    );
  }, 10000); // Increase timeout to 10 seconds

  /**
   * Property 7.9: Context accessible without explicit parameter passing
   * 
   * For any tenant context and any function call depth,
   * functions should be able to access context without receiving it as parameter.
   */
  test('should access context without explicit parameter passing', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantContextArbitrary(),
        async (tenant) => {
          // Helper functions that don't receive tenant as parameter
          const level3Function = async () => {
            await new Promise(resolve => setImmediate(resolve));
            return getTenantContext();
          };
          
          const level2Function = async () => {
            await new Promise(resolve => setTimeout(resolve, 5));
            const context2 = getTenantContext();
            const context3 = await level3Function();
            return { context2, context3 };
          };
          
          const level1Function = async () => {
            const context1 = getTenantContext();
            const { context2, context3 } = await level2Function();
            return { context1, context2, context3 };
          };
          
          const result = await runWithTenantContext(tenant, level1Function);
          
          // All levels should have access to the same context
          return result.context1 !== undefined &&
                 result.context2 !== undefined &&
                 result.context3 !== undefined &&
                 result.context1.id === tenant.id &&
                 result.context2.id === tenant.id &&
                 result.context3.id === tenant.id &&
                 result.context1.slug === tenant.slug &&
                 result.context2.slug === tenant.slug &&
                 result.context3.slug === tenant.slug;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.10: Context propagates through mixed async patterns
   * 
   * For any tenant context, the context must remain accessible
   * through a mix of async/await, Promises, and callbacks.
   */
  test('should propagate context through mixed async patterns', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantContextArbitrary(),
        async (tenant) => {
          const result = await runWithTenantContext(tenant, async () => {
            // async/await
            await new Promise(resolve => setTimeout(resolve, 5));
            const context1 = getTenantContext();
            
            // Promise chain
            const context2 = await Promise.resolve()
              .then(() => new Promise(resolve => setImmediate(resolve)))
              .then(() => getTenantContext());
            
            // Callback wrapped in Promise
            const context3 = await new Promise((resolve) => {
              setTimeout(() => {
                resolve(getTenantContext());
              }, 5);
            });
            
            // Promise.all with mixed patterns
            const [context4, context5] = await Promise.all([
              (async () => {
                await new Promise(resolve => setImmediate(resolve));
                return getTenantContext();
              })(),
              new Promise(resolve => {
                setTimeout(() => resolve(getTenantContext()), 5);
              })
            ]);
            
            return context1 !== undefined &&
                   context2 !== undefined &&
                   context3 !== undefined &&
                   context4 !== undefined &&
                   context5 !== undefined &&
                   context1.id === tenant.id &&
                   context2.id === tenant.id &&
                   context3.id === tenant.id &&
                   context4.id === tenant.id &&
                   context5.id === tenant.id;
          });
          
          return result === true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
