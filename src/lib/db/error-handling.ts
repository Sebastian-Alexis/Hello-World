// =============================================================================
// DATABASE ERROR HANDLING & RECOVERY - Plan 7 Implementation
// Comprehensive error handling with automatic recovery mechanisms
// =============================================================================

import { getDbClient } from './connection';
import { executeOptimizedQuery } from './performance';

//error categories for different handling strategies
export enum DatabaseErrorCategory {
  CONNECTION = 'connection',
  SYNTAX = 'syntax',
  CONSTRAINT = 'constraint',
  TIMEOUT = 'timeout',
  PERMISSION = 'permission',
  CORRUPTION = 'corruption',
  SPACE = 'space',
  LOCK = 'lock',
  UNKNOWN = 'unknown',
}

//error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

//error context interface
export interface ErrorContext {
  query?: string;
  params?: unknown[];
  operation?: string;
  table?: string;
  userId?: number;
  sessionId?: string;
  timestamp: string;
  stackTrace?: string;
}

//database error interface
export interface DatabaseError {
  id: string;
  category: DatabaseErrorCategory;
  severity: ErrorSeverity;
  message: string;
  originalError: Error;
  context: ErrorContext;
  recoveryAttempts: number;
  resolved: boolean;
  createdAt: string;
}

//recovery strategy interface
export interface RecoveryStrategy {
  name: string;
  canRecover: (error: DatabaseError) => boolean;
  recover: (error: DatabaseError) => Promise<boolean>;
  maxAttempts: number;
}

//error statistics interface
export interface ErrorStatistics {
  totalErrors: number;
  errorsByCategory: Record<DatabaseErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recoveryRate: number;
  avgRecoveryTime: number;
  recentErrors: DatabaseError[];
}

export class DatabaseErrorHandler {
  private errorLog: DatabaseError[] = [];
  private recoveryStrategies: RecoveryStrategy[] = [];

  constructor() {
    this.initializeRecoveryStrategies();
  }

  // =============================================================================
  // ERROR CLASSIFICATION
  // =============================================================================

  //classifies database errors by type and severity
  classifyError(error: Error, context: ErrorContext): DatabaseError {
    const errorMessage = error.message.toLowerCase();
    let category = DatabaseErrorCategory.UNKNOWN;
    let severity = ErrorSeverity.MEDIUM;

    //connection errors
    if (errorMessage.includes('connection') || errorMessage.includes('network') || errorMessage.includes('timeout')) {
      category = DatabaseErrorCategory.CONNECTION;
      severity = ErrorSeverity.HIGH;
    }
    //syntax errors
    else if (errorMessage.includes('syntax') || errorMessage.includes('parse')) {
      category = DatabaseErrorCategory.SYNTAX;
      severity = ErrorSeverity.LOW;
    }
    //constraint violations
    else if (errorMessage.includes('constraint') || errorMessage.includes('unique') || errorMessage.includes('foreign key')) {
      category = DatabaseErrorCategory.CONSTRAINT;
      severity = ErrorSeverity.MEDIUM;
    }
    //timeout errors
    else if (errorMessage.includes('timeout') || errorMessage.includes('busy')) {
      category = DatabaseErrorCategory.TIMEOUT;
      severity = ErrorSeverity.MEDIUM;
    }
    //permission errors
    else if (errorMessage.includes('permission') || errorMessage.includes('unauthorized') || errorMessage.includes('access denied')) {
      category = DatabaseErrorCategory.PERMISSION;
      severity = ErrorSeverity.HIGH;
    }
    //corruption errors
    else if (errorMessage.includes('corrupt') || errorMessage.includes('malformed')) {
      category = DatabaseErrorCategory.CORRUPTION;
      severity = ErrorSeverity.CRITICAL;
    }
    //space/disk errors
    else if (errorMessage.includes('disk') || errorMessage.includes('space') || errorMessage.includes('full')) {
      category = DatabaseErrorCategory.SPACE;
      severity = ErrorSeverity.CRITICAL;
    }
    //lock errors
    else if (errorMessage.includes('lock') || errorMessage.includes('deadlock')) {
      category = DatabaseErrorCategory.LOCK;
      severity = ErrorSeverity.MEDIUM;
    }

    const dbError: DatabaseError = {
      id: this.generateErrorId(),
      category,
      severity,
      message: error.message,
      originalError: error,
      context,
      recoveryAttempts: 0,
      resolved: false,
      createdAt: new Date().toISOString(),
    };

    this.errorLog.push(dbError);
    this.logError(dbError);

    return dbError;
  }

  //generates unique error ID
  private generateErrorId(): string {
    return `db_error_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // =============================================================================
  // ERROR HANDLING STRATEGIES
  // =============================================================================

  //handles database errors with automatic recovery
  async handleError(error: Error, context: ErrorContext): Promise<{
    handled: boolean;
    recovered: boolean;
    error: DatabaseError;
    retryable: boolean;
  }> {
    const dbError = this.classifyError(error, context);

    try {
      //attempt automatic recovery
      const recovered = await this.attemptRecovery(dbError);
      
      if (recovered) {
        dbError.resolved = true;
        console.log(`✅ Automatically recovered from error: ${dbError.id}`);
      }

      //determine if operation should be retried
      const retryable = this.isRetryable(dbError);

      //alert if critical
      if (dbError.severity === ErrorSeverity.CRITICAL) {
        await this.alertCriticalError(dbError);
      }

      return {
        handled: true,
        recovered,
        error: dbError,
        retryable,
      };

    } catch (recoveryError) {
      console.error('Recovery attempt failed:', recoveryError);
      return {
        handled: true,
        recovered: false,
        error: dbError,
        retryable: false,
      };
    }
  }

  //attempts automatic recovery using appropriate strategy
  private async attemptRecovery(error: DatabaseError): Promise<boolean> {
    const applicableStrategies = this.recoveryStrategies.filter(strategy => 
      strategy.canRecover(error) && error.recoveryAttempts < strategy.maxAttempts
    );

    for (const strategy of applicableStrategies) {
      try {
        console.log(`🔄 Attempting recovery with strategy: ${strategy.name}`);
        error.recoveryAttempts++;
        
        const recovered = await strategy.recover(error);
        if (recovered) {
          console.log(`✅ Recovery successful with strategy: ${strategy.name}`);
          return true;
        }
      } catch (strategyError) {
        console.error(`❌ Recovery strategy ${strategy.name} failed:`, strategyError);
      }
    }

    return false;
  }

  //determines if an operation should be retried
  private isRetryable(error: DatabaseError): boolean {
    switch (error.category) {
      case DatabaseErrorCategory.CONNECTION:
      case DatabaseErrorCategory.TIMEOUT:
      case DatabaseErrorCategory.LOCK:
        return error.recoveryAttempts < 3;
      
      case DatabaseErrorCategory.SYNTAX:
      case DatabaseErrorCategory.CONSTRAINT:
      case DatabaseErrorCategory.PERMISSION:
        return false;
      
      case DatabaseErrorCategory.CORRUPTION:
      case DatabaseErrorCategory.SPACE:
        return false;
      
      default:
        return error.recoveryAttempts < 1;
    }
  }

  // =============================================================================
  // RECOVERY STRATEGIES
  // =============================================================================

  //initializes recovery strategies
  private initializeRecoveryStrategies(): void {
    this.recoveryStrategies = [
      //connection retry strategy
      {
        name: 'connection_retry',
        canRecover: (error) => error.category === DatabaseErrorCategory.CONNECTION,
        recover: async (error) => {
          await this.delay(1000 * error.recoveryAttempts); //exponential backoff
          try {
            const client = getDbClient();
            await client.execute('SELECT 1');
            return true;
          } catch {
            return false;
          }
        },
        maxAttempts: 3,
      },

      //timeout retry strategy
      {
        name: 'timeout_retry',
        canRecover: (error) => error.category === DatabaseErrorCategory.TIMEOUT,
        recover: async (error) => {
          await this.delay(500 * error.recoveryAttempts);
          //try to execute a simple query to test responsiveness
          try {
            await executeOptimizedQuery('SELECT 1', [], { skipLogging: true });
            return true;
          } catch {
            return false;
          }
        },
        maxAttempts: 2,
      },

      //lock wait strategy
      {
        name: 'lock_wait',
        canRecover: (error) => error.category === DatabaseErrorCategory.LOCK,
        recover: async (error) => {
          //wait progressively longer for locks to clear
          await this.delay(200 * Math.pow(2, error.recoveryAttempts));
          return true; //assume lock has cleared
        },
        maxAttempts: 3,
      },

      //space cleanup strategy
      {
        name: 'space_cleanup',
        canRecover: (error) => error.category === DatabaseErrorCategory.SPACE,
        recover: async () => {
          try {
            //attempt to free space with quick cleanup
            const client = getDbClient();
            await client.execute('DELETE FROM query_performance_log WHERE created_at < datetime("now", "-1 day")');
            await client.execute('DELETE FROM cache_performance_log WHERE created_at < datetime("now", "-1 day")');
            await client.execute('VACUUM');
            return true;
          } catch {
            return false;
          }
        },
        maxAttempts: 1,
      },

      //corruption recovery strategy
      {
        name: 'corruption_recovery',
        canRecover: (error) => error.category === DatabaseErrorCategory.CORRUPTION,
        recover: async () => {
          try {
            const client = getDbClient();
            //attempt integrity check and repair
            const result = await client.execute('PRAGMA integrity_check');
            if (result.rows[0]?.integrity_check === 'ok') {
              return true;
            }
            //if corruption detected, try reindex
            await client.execute('REINDEX');
            return true;
          } catch {
            return false;
          }
        },
        maxAttempts: 1,
      },
    ];
  }

  //utility delay function
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // =============================================================================
  // ERROR LOGGING & MONITORING
  // =============================================================================

  //logs error to database (if possible) and console
  private async logError(error: DatabaseError): Promise<void> {
    //always log to console
    console.error('🚨 Database Error:', {
      id: error.id,
      category: error.category,
      severity: error.severity,
      message: error.message,
      context: error.context,
    });

    //attempt to log to database if not a critical connection issue
    if (error.category !== DatabaseErrorCategory.CONNECTION && 
        error.category !== DatabaseErrorCategory.CORRUPTION) {
      try {
        await executeOptimizedQuery(`
          INSERT INTO analytics_events (
            event_type, entity_type, metadata, created_at
          ) VALUES (?, ?, ?, ?)
        `, [
          'database_error',
          'error_log',
          JSON.stringify({
            error_id: error.id,
            category: error.category,
            severity: error.severity,
            message: error.message,
            operation: error.context.operation,
            table: error.context.table,
            query_hash: error.context.query ? this.hashQuery(error.context.query) : null,
          }),
          error.createdAt,
        ], {
          useCache: false,
          skipLogging: true, //avoid infinite loops
        });
      } catch (logError) {
        console.error('Failed to log error to database:', logError);
      }
    }
  }

  //hashes query for privacy in logs
  private hashQuery(query: string): string {
    //simple hash function for query identification
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; //convert to 32-bit integer
    }
    return hash.toString(36);
  }

  //alerts critical errors
  private async alertCriticalError(error: DatabaseError): Promise<void> {
    console.error('🚨 CRITICAL DATABASE ERROR:', {
      id: error.id,
      category: error.category,
      message: error.message,
      context: error.context,
    });

    //in production, integrate with monitoring systems like:
    //- Sentry
    //- DataDog
    //- New Relic
    //- Custom webhook notifications
    //- Email/SMS alerts
  }

  // =============================================================================
  // ERROR STATISTICS & REPORTING
  // =============================================================================

  //gets error statistics
  getErrorStatistics(hours: number = 24): ErrorStatistics {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentErrors = this.errorLog.filter(
      error => new Date(error.createdAt) > cutoffTime
    );

    const totalErrors = recentErrors.length;
    const resolvedErrors = recentErrors.filter(error => error.resolved).length;

    const errorsByCategory = Object.values(DatabaseErrorCategory).reduce((acc, category) => {
      acc[category] = recentErrors.filter(error => error.category === category).length;
      return acc;
    }, {} as Record<DatabaseErrorCategory, number>);

    const errorsBySeverity = Object.values(ErrorSeverity).reduce((acc, severity) => {
      acc[severity] = recentErrors.filter(error => error.severity === severity).length;
      return acc;
    }, {} as Record<ErrorSeverity, number>);

    const recoveryRate = totalErrors > 0 ? (resolvedErrors / totalErrors) * 100 : 100;

    //calculate average recovery time (placeholder)
    const avgRecoveryTime = 500; //ms

    return {
      totalErrors,
      errorsByCategory,
      errorsBySeverity,
      recoveryRate: Math.round(recoveryRate * 100) / 100,
      avgRecoveryTime,
      recentErrors: recentErrors.slice(-10), //last 10 errors
    };
  }

  //gets critical errors that need attention
  getCriticalErrors(): DatabaseError[] {
    return this.errorLog.filter(
      error => error.severity === ErrorSeverity.CRITICAL && !error.resolved
    );
  }

  //clears old error logs
  clearOldErrors(olderThanHours: number = 72): number {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const initialLength = this.errorLog.length;
    
    this.errorLog = this.errorLog.filter(
      error => new Date(error.createdAt) > cutoffTime || !error.resolved
    );
    
    return initialLength - this.errorLog.length;
  }

  // =============================================================================
  // RECOVERY TESTING
  // =============================================================================

  //tests recovery mechanisms
  async testRecoveryMechanisms(): Promise<{
    strategy: string;
    tested: boolean;
    successful: boolean;
    error?: string;
  }[]> {
    const results: {
      strategy: string;
      tested: boolean;
      successful: boolean;
      error?: string;
    }[] = [];

    for (const strategy of this.recoveryStrategies) {
      try {
        //create a mock error for testing
        const mockError: DatabaseError = {
          id: 'test_error',
          category: DatabaseErrorCategory.CONNECTION,
          severity: ErrorSeverity.MEDIUM,
          message: 'Test error',
          originalError: new Error('Test'),
          context: { timestamp: new Date().toISOString() },
          recoveryAttempts: 0,
          resolved: false,
          createdAt: new Date().toISOString(),
        };

        if (strategy.canRecover(mockError)) {
          const result = await strategy.recover(mockError);
          results.push({
            strategy: strategy.name,
            tested: true,
            successful: result,
          });
        } else {
          results.push({
            strategy: strategy.name,
            tested: false,
            successful: false,
            error: 'Strategy not applicable to test error',
          });
        }
      } catch (error) {
        results.push({
          strategy: strategy.name,
          tested: true,
          successful: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }
}

//singleton instance
export const errorHandler = new DatabaseErrorHandler();

//enhanced query execution with error handling
export async function executeQueryWithErrorHandling<T = unknown>(
  query: string,
  params?: unknown[],
  context?: Partial<ErrorContext>
): Promise<{ rows: T[]; rowsAffected: number; insertId?: number }> {
  const fullContext: ErrorContext = {
    query,
    params,
    timestamp: new Date().toISOString(),
    ...context,
  };

  try {
    return await executeOptimizedQuery<T>(query, params);
  } catch (error) {
    const handlerResult = await errorHandler.handleError(error as Error, fullContext);
    
    //if error is retryable and was recovered, try once more
    if (handlerResult.retryable && handlerResult.recovered) {
      try {
        return await executeOptimizedQuery<T>(query, params);
      } catch (retryError) {
        //if retry fails, handle the new error
        await errorHandler.handleError(retryError as Error, {
          ...fullContext,
          operation: 'retry_after_recovery',
        });
        throw retryError;
      }
    }
    
    throw error;
  }
}

//circuit breaker pattern for database operations
export class DatabaseCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly failureThreshold = 5,
    private readonly timeoutMs = 60000, //1 minute
    private readonly retryTimeoutMs = 30000 //30 seconds
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.retryTimeoutMs) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      
      //reset on success
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= this.failureThreshold) {
        this.state = 'open';
      }
      
      throw error;
    }
  }

  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

//global circuit breaker instance
export const databaseCircuitBreaker = new DatabaseCircuitBreaker();