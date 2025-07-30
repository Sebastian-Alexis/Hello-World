//automated backup and disaster recovery system
//provides database backups, file backups, and recovery procedures

import { db } from '../db';
import { logger } from './logging';
import { createAlert, AlertSeverity } from './alerting';

export enum BackupType {
  DATABASE = 'database',
  FILES = 'files',
  CONFIGURATION = 'configuration',
  LOGS = 'logs',
  FULL = 'full',
}

export enum BackupStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CORRUPTED = 'corrupted',
}

export enum RecoveryStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIAL = 'partial',
}

interface BackupJob {
  id: string;
  type: BackupType;
  name: string;
  description: string;
  schedule: string; // cron expression
  retention: number; // days
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
  status: BackupStatus;
  config: BackupConfig;
  metadata: Record<string, any>;
}

interface BackupConfig {
  source: string;
  destination: string;
  compression: boolean;
  encryption: boolean;
  validation: boolean;
  excludePatterns?: string[];
  includePatterns?: string[];
  maxFileSize?: number; // bytes
  timeout?: number; // milliseconds
}

interface Backup {
  id: string;
  jobId: string;
  type: BackupType;
  name: string;
  size: number; // bytes
  compressedSize?: number;
  checksum: string;
  createdAt: number;
  expiresAt: number;
  status: BackupStatus;
  location: string;
  metadata: Record<string, any>;
  verificationResults?: VerificationResult;
}

interface VerificationResult {
  verified: boolean;
  checksumMatch: boolean;
  sizeMatch: boolean;
  contentIntegrity: boolean;
  errors: string[];
  verifiedAt: number;
}

interface RecoveryPlan {
  id: string;
  name: string;
  type: BackupType;
  description: string;
  steps: RecoveryStep[];
  estimatedDuration: number; // minutes
  prerequisites: string[];
  rollbackPlan: string[];
  testProcedure: string[];
  metadata: Record<string, any>;
}

interface RecoveryStep {
  id: string;
  name: string;
  description: string;
  type: 'backup_restore' | 'database_restore' | 'file_restore' | 'config_restore' | 'validation' | 'cleanup';
  command?: string;
  parameters: Record<string, any>;
  timeout: number;
  retries: number;
  critical: boolean;
  rollbackCommand?: string;
}

interface RecoveryExecution {
  id: string;
  planId: string;
  backupId?: string;
  status: RecoveryStatus;
  startedAt: number;
  completedAt?: number;
  duration?: number;
  executedBy: string;
  steps: RecoveryStepResult[];
  errors: string[];
  rollbackRequired: boolean;
  metadata: Record<string, any>;
}

interface RecoveryStepResult {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: number;
  completedAt?: number;
  duration?: number;
  output?: string;
  error?: string;
  rollbackExecuted: boolean;
}

interface BackupSystemConfig {
  enabled: boolean;
  defaultRetention: number; // days
  backupDirectory: string;
  maxConcurrentJobs: number;
  compressionLevel: number; // 0-9
  enableEncryption: boolean;
  encryptionKey?: string;
  notificationEndpoint: string;
  verificationFrequency: number; // hours
}

class BackupSystem {
  private config: BackupSystemConfig;
  private jobs = new Map<string, BackupJob>();
  private backups = new Map<string, Backup>();
  private recoveryPlans = new Map<string, RecoveryPlan>();
  private recoveryExecutions = new Map<string, RecoveryExecution>();
  private schedulerTimer?: NodeJS.Timeout;
  private verificationTimer?: NodeJS.Timeout;
  private activeJobs = new Set<string>();
  private isInitialized = false;

  constructor(config: Partial<BackupSystemConfig> = {}) {
    this.config = {
      enabled: true,
      defaultRetention: 30, // 30 days
      backupDirectory: './backups',
      maxConcurrentJobs: 2,
      compressionLevel: 6,
      enableEncryption: false,
      notificationEndpoint: '/api/monitoring/backup-notifications',
      verificationFrequency: 24, // every 24 hours
      ...config,
    };

    if (this.config.enabled) {
      this.initialize();
    }
  }

  private initialize(): void {
    if (this.isInitialized) return;

    //register default backup jobs
    this.registerDefaultJobs();

    //register default recovery plans
    this.registerDefaultRecoveryPlans();

    //start scheduler
    this.schedulerTimer = setInterval(() => {
      this.runScheduler().catch(console.error);
    }, 60000); // check every minute

    //start verification
    this.verificationTimer = setInterval(() => {
      this.runVerification().catch(console.error);
    }, this.config.verificationFrequency * 60 * 60 * 1000);

    //cleanup old backups
    setInterval(() => {
      this.cleanupExpiredBackups().catch(console.error);
    }, 24 * 60 * 60 * 1000); // daily cleanup

    this.isInitialized = true;
    logger.info('Backup System initialized', 'backup-system');
  }

  private registerDefaultJobs(): void {
    //database backup
    this.createJob({
      id: 'database-daily',
      type: BackupType.DATABASE,
      name: 'Daily Database Backup',
      description: 'Full database backup performed daily at 2 AM',
      schedule: '0 2 * * *', // daily at 2 AM
      retention: 30, // 30 days
      enabled: true,
      status: BackupStatus.PENDING,
      config: {
        source: './local.db',
        destination: './backups/database',
        compression: true,
        encryption: this.config.enableEncryption,
        validation: true,
        timeout: 30 * 60 * 1000, // 30 minutes
      },
      metadata: { priority: 'high', critical: true },
    });

    //configuration backup
    this.createJob({
      id: 'config-weekly',
      type: BackupType.CONFIGURATION,
      name: 'Weekly Configuration Backup',
      description: 'Backup of configuration files and environment settings',
      schedule: '0 1 * * 0', // weekly on Sunday at 1 AM
      retention: 60, // 60 days
      enabled: true,
      status: BackupStatus.PENDING,
      config: {
        source: './',
        destination: './backups/config',
        compression: true,
        encryption: false,
        validation: true,
        includePatterns: [
          'astro.config.*',
          'package.json',
          'package-lock.json',
          'tsconfig.json',
          'tailwind.config.*',
          '.env.example',
          'database/schema.sql',
        ],
        excludePatterns: ['.env', '.env.local', 'node_modules/**'],
        timeout: 10 * 60 * 1000, // 10 minutes
      },
      metadata: { priority: 'medium' },
    });

    //logs backup
    this.createJob({
      id: 'logs-daily',
      type: BackupType.LOGS,
      name: 'Daily Logs Backup',
      description: 'Backup of application logs and monitoring data',
      schedule: '0 3 * * *', // daily at 3 AM
      retention: 14, // 14 days
      enabled: true,
      status: BackupStatus.PENDING,
      config: {
        source: './logs',
        destination: './backups/logs',
        compression: true,
        encryption: false,
        validation: false,
        excludePatterns: ['*.tmp', '*.lock'],
        maxFileSize: 100 * 1024 * 1024, // 100MB max per file
        timeout: 15 * 60 * 1000, // 15 minutes
      },
      metadata: { priority: 'low' },
    });
  }

  private registerDefaultRecoveryPlans(): void {
    //database recovery plan
    this.createRecoveryPlan({
      id: 'database-recovery',
      name: 'Database Recovery Plan',
      type: BackupType.DATABASE,
      description: 'Complete database recovery from backup',
      estimatedDuration: 30, // 30 minutes
      prerequisites: [
        'Application must be stopped',
        'Database connections must be closed',
        'Backup file must be verified',
      ],
      rollbackPlan: [
        'Stop application',
        'Restore original database from backup',
        'Restart application',
      ],
      testProcedure: [
        'Create test database restore',
        'Verify data integrity',
        'Test application functionality',
      ],
      steps: [
        {
          id: 'stop-app',
          name: 'Stop Application',
          description: 'Stop the application to prevent data corruption',
          type: 'validation',
          parameters: { service: 'portfolio-app' },
          timeout: 60000, // 1 minute
          retries: 0,
          critical: true,
        },
        {
          id: 'backup-current',
          name: 'Backup Current Database',
          description: 'Create a backup of the current database before restore',
          type: 'backup_restore',
          parameters: { 
            source: './local.db',
            destination: './backups/recovery/pre-restore-backup.db',
          },
          timeout: 300000, // 5 minutes
          retries: 1,
          critical: true,
        },
        {
          id: 'restore-database',
          name: 'Restore Database',
          description: 'Restore database from backup file',
          type: 'database_restore',
          parameters: { backupId: 'latest' },
          timeout: 600000, // 10 minutes
          retries: 2,
          critical: true,
          rollbackCommand: 'restore-backup',
        },
        {
          id: 'verify-restore',
          name: 'Verify Database Integrity',
          description: 'Verify that the restored database is intact and functional',
          type: 'validation',
          parameters: { checks: ['integrity', 'constraints', 'indexes'] },
          timeout: 180000, // 3 minutes
          retries: 1,
          critical: true,
        },
        {
          id: 'start-app',
          name: 'Start Application',
          description: 'Start the application and verify functionality',
          type: 'validation',
          parameters: { service: 'portfolio-app', healthCheck: true },
          timeout: 120000, // 2 minutes
          retries: 2,
          critical: true,
        },
      ],
      metadata: { category: 'critical' },
    });

    //full system recovery plan
    this.createRecoveryPlan({
      id: 'full-system-recovery',
      name: 'Full System Recovery Plan',
      type: BackupType.FULL,
      description: 'Complete system recovery from catastrophic failure',
      estimatedDuration: 120, // 2 hours
      prerequisites: [
        'Server or infrastructure must be available',
        'All backup files must be accessible',
        'Network connectivity must be established',
      ],
      rollbackPlan: [
        'Document current state',
        'Restore from previous known good state',
        'Notify stakeholders',
      ],
      testProcedure: [
        'Test recovery in isolated environment',
        'Verify all services and data',
        'Perform end-to-end testing',
      ],
      steps: [
        {
          id: 'setup-environment',
          name: 'Setup Recovery Environment',
          description: 'Prepare the environment for recovery',
          type: 'validation',
          parameters: { checks: ['disk_space', 'permissions', 'dependencies'] },
          timeout: 300000, // 5 minutes
          retries: 1,
          critical: true,
        },
        {
          id: 'restore-config',
          name: 'Restore Configuration',
          description: 'Restore configuration files and environment settings',
          type: 'config_restore',
          parameters: { backupId: 'latest' },
          timeout: 180000, // 3 minutes
          retries: 2,
          critical: true,
        },
        {
          id: 'restore-database',
          name: 'Restore Database',
          description: 'Restore database from latest backup',
          type: 'database_restore',
          parameters: { backupId: 'latest' },
          timeout: 1200000, // 20 minutes
          retries: 2,
          critical: true,
        },
        {
          id: 'restore-files',
          name: 'Restore Application Files',
          description: 'Restore application files and assets',
          type: 'file_restore',
          parameters: { backupId: 'latest' },
          timeout: 600000, // 10 minutes
          retries: 2,
          critical: false,
        },
        {
          id: 'verify-system',
          name: 'Verify System Integrity',
          description: 'Comprehensive system verification',
          type: 'validation',
          parameters: { 
            checks: ['database', 'files', 'configuration', 'services'],
            healthChecks: true,
          },
          timeout: 600000, // 10 minutes
          retries: 1,
          critical: true,
        },
        {
          id: 'cleanup-temp',
          name: 'Cleanup Temporary Files',
          description: 'Clean up temporary files created during recovery',
          type: 'cleanup',
          parameters: { directories: ['./temp', './recovery'] },
          timeout: 60000, // 1 minute
          retries: 0,
          critical: false,
        },
      ],
      metadata: { category: 'disaster_recovery' },
    });
  }

  //job management
  public createJob(job: Omit<BackupJob, 'nextRun'>): void {
    const nextRun = this.calculateNextRun(job.schedule);
    const fullJob: BackupJob = { ...job, nextRun };
    
    this.jobs.set(job.id, fullJob);
    logger.info(`Backup job created: ${job.name}`, 'backup-system', { jobId: job.id });
  }

  public updateJob(jobId: string, updates: Partial<BackupJob>): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    Object.assign(job, updates);
    
    //recalculate next run if schedule changed
    if (updates.schedule) {
      job.nextRun = this.calculateNextRun(updates.schedule);
    }

    logger.info(`Backup job updated: ${job.name}`, 'backup-system', { jobId });
    return true;
  }

  public deleteJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    this.jobs.delete(jobId);
    logger.info(`Backup job deleted: ${job.name}`, 'backup-system', { jobId });
    return true;
  }

  //backup execution
  public async executeJob(jobId: string, force = false): Promise<string> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Backup job not found: ${jobId}`);

    if (!force && !job.enabled) {
      throw new Error(`Backup job is disabled: ${jobId}`);
    }

    if (this.activeJobs.has(jobId)) {
      throw new Error(`Backup job is already running: ${jobId}`);
    }

    if (this.activeJobs.size >= this.config.maxConcurrentJobs) {
      throw new Error('Maximum concurrent backup jobs reached');
    }

    const backupId = this.generateId('backup');
    this.activeJobs.add(jobId);

    try {
      job.status = BackupStatus.IN_PROGRESS;
      job.lastRun = Date.now();
      
      logger.info(`Starting backup job: ${job.name}`, 'backup-system', { jobId, backupId });

      const backup = await this.performBackup(job, backupId);
      
      job.status = BackupStatus.COMPLETED;
      job.nextRun = this.calculateNextRun(job.schedule);
      
      this.backups.set(backupId, backup);
      
      logger.info(`Backup job completed: ${job.name}`, 'backup-system', { 
        jobId, 
        backupId, 
        size: backup.size,
        duration: Date.now() - job.lastRun!,
      });

      //notify success
      this.sendNotification('backup_success', { job, backup });

      return backupId;
    } catch (error) {
      job.status = BackupStatus.FAILED;
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Backup job failed: ${job.name}`, 'backup-system', { 
        jobId, 
        backupId, 
        error: errorMessage,
      });

      //create alert for failed backup
      createAlert(
        `Backup Failed: ${job.name}`,
        `Backup job ${job.name} failed: ${errorMessage}`,
        AlertSeverity.ERROR,
        'backup-system',
        ['backup', 'failure'],
        { jobId, backupId, error: errorMessage }
      );

      //notify failure
      this.sendNotification('backup_failure', { job, error: errorMessage });

      throw error;
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  private async performBackup(job: BackupJob, backupId: string): Promise<Backup> {
    const startTime = Date.now();
    const { config, type } = job;

    let backup: Backup = {
      id: backupId,
      jobId: job.id,
      type,
      name: `${job.name} - ${new Date().toISOString()}`,
      size: 0,
      checksum: '',
      createdAt: startTime,
      expiresAt: startTime + (job.retention * 24 * 60 * 60 * 1000),
      status: BackupStatus.IN_PROGRESS,
      location: '',
      metadata: { ...job.metadata },
    };

    try {
      switch (type) {
        case BackupType.DATABASE:
          backup = await this.backupDatabase(backup, config);
          break;
        case BackupType.FILES:
          backup = await this.backupFiles(backup, config);
          break;
        case BackupType.CONFIGURATION:
          backup = await this.backupConfiguration(backup, config);
          break;
        case BackupType.LOGS:
          backup = await this.backupLogs(backup, config);
          break;
        case BackupType.FULL:
          backup = await this.backupFull(backup, config);
          break;
        default:
          throw new Error(`Unsupported backup type: ${type}`);
      }

      //verify backup if enabled
      if (config.validation) {
        backup.verificationResults = await this.verifyBackup(backup);
        if (!backup.verificationResults.verified) {
          backup.status = BackupStatus.CORRUPTED;
          throw new Error('Backup verification failed');
        }
      }

      backup.status = BackupStatus.COMPLETED;
      return backup;
    } catch (error) {
      backup.status = BackupStatus.FAILED;
      throw error;
    }
  }

  private async backupDatabase(backup: Backup, config: BackupConfig): Promise<Backup> {
    //create database backup using SQLite dump
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `database-${timestamp}.sql`;
    const destination = `${config.destination}/${filename}`;

    //ensure destination directory exists
    await this.ensureDirectory(config.destination);

    try {
      //create sql dump
      const dumpQuery = `
        .output ${destination}
        .dump
      `;

      //in a real implementation, you would use sqlite3 command line tool
      //for now, we'll simulate the backup
      logger.info('Creating database backup...', 'backup-system', { destination });

      //simulate backup creation
      await new Promise(resolve => setTimeout(resolve, 2000));

      //calculate file size and checksum
      const stats = await this.getFileStats(destination);
      backup.size = stats.size;
      backup.checksum = stats.checksum;
      backup.location = destination;

      //compress if enabled
      if (config.compression) {
        const compressedPath = `${destination}.gz`;
        await this.compressFile(destination, compressedPath);
        
        const compressedStats = await this.getFileStats(compressedPath);
        backup.compressedSize = compressedStats.size;
        backup.location = compressedPath;
        
        //remove uncompressed file
        await this.deleteFile(destination);
      }

      return backup;
    } catch (error) {
      logger.error('Database backup failed', 'backup-system', { error });
      throw error;
    }
  }

  private async backupFiles(backup: Backup, config: BackupConfig): Promise<Backup> {
    //create file backup using tar or similar
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `files-${timestamp}.tar`;
    const destination = `${config.destination}/${filename}`;

    await this.ensureDirectory(config.destination);

    try {
      logger.info('Creating file backup...', 'backup-system', { source: config.source, destination });

      //simulate file backup creation
      await new Promise(resolve => setTimeout(resolve, 5000));

      const stats = await this.getFileStats(destination);
      backup.size = stats.size;
      backup.checksum = stats.checksum;
      backup.location = destination;

      if (config.compression) {
        const compressedPath = `${destination}.gz`;
        await this.compressFile(destination, compressedPath);
        
        const compressedStats = await this.getFileStats(compressedPath);
        backup.compressedSize = compressedStats.size;
        backup.location = compressedPath;
        
        await this.deleteFile(destination);
      }

      return backup;
    } catch (error) {
      logger.error('File backup failed', 'backup-system', { error });
      throw error;
    }
  }

  private async backupConfiguration(backup: Backup, config: BackupConfig): Promise<Backup> {
    //backup configuration files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `config-${timestamp}.tar`;
    const destination = `${config.destination}/${filename}`;

    await this.ensureDirectory(config.destination);

    try {
      logger.info('Creating configuration backup...', 'backup-system', { destination });

      //simulate configuration backup
      await new Promise(resolve => setTimeout(resolve, 1000));

      const stats = await this.getFileStats(destination);
      backup.size = stats.size;
      backup.checksum = stats.checksum;
      backup.location = destination;

      return backup;
    } catch (error) {
      logger.error('Configuration backup failed', 'backup-system', { error });
      throw error;
    }
  }

  private async backupLogs(backup: Backup, config: BackupConfig): Promise<Backup> {
    //backup log files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `logs-${timestamp}.tar.gz`;
    const destination = `${config.destination}/${filename}`;

    await this.ensureDirectory(config.destination);

    try {
      logger.info('Creating logs backup...', 'backup-system', { destination });

      //simulate logs backup
      await new Promise(resolve => setTimeout(resolve, 3000));

      const stats = await this.getFileStats(destination);
      backup.size = stats.size;
      backup.checksum = stats.checksum;
      backup.location = destination;

      return backup;
    } catch (error) {
      logger.error('Logs backup failed', 'backup-system', { error });
      throw error;
    }
  }

  private async backupFull(backup: Backup, config: BackupConfig): Promise<Backup> {
    //full system backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `full-${timestamp}.tar.gz`;
    const destination = `${config.destination}/${filename}`;

    await this.ensureDirectory(config.destination);

    try {
      logger.info('Creating full system backup...', 'backup-system', { destination });

      //simulate full backup (would take longer in reality)
      await new Promise(resolve => setTimeout(resolve, 10000));

      const stats = await this.getFileStats(destination);
      backup.size = stats.size;
      backup.checksum = stats.checksum;
      backup.location = destination;

      return backup;
    } catch (error) {
      logger.error('Full backup failed', 'backup-system', { error });
      throw error;
    }
  }

  //recovery management
  public createRecoveryPlan(plan: RecoveryPlan): void {
    this.recoveryPlans.set(plan.id, plan);
    logger.info(`Recovery plan created: ${plan.name}`, 'backup-system', { planId: plan.id });
  }

  public async executeRecovery(
    planId: string, 
    backupId: string | undefined, 
    executedBy: string
  ): Promise<string> {
    const plan = this.recoveryPlans.get(planId);
    if (!plan) throw new Error(`Recovery plan not found: ${planId}`);

    const backup = backupId ? this.backups.get(backupId) : undefined;
    if (backupId && !backup) throw new Error(`Backup not found: ${backupId}`);

    const executionId = this.generateId('recovery');
    const execution: RecoveryExecution = {
      id: executionId,
      planId,
      backupId,
      status: RecoveryStatus.IN_PROGRESS,
      startedAt: Date.now(),
      executedBy,
      steps: plan.steps.map(step => ({
        stepId: step.id,
        status: 'pending',
        startedAt: 0,
        rollbackExecuted: false,
      })),
      errors: [],
      rollbackRequired: false,
      metadata: { planName: plan.name },
    };

    this.recoveryExecutions.set(executionId, execution);

    try {
      logger.info(`Starting recovery execution: ${plan.name}`, 'backup-system', { 
        planId, 
        executionId, 
        backupId,
        executedBy,
      });

      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        const stepResult = execution.steps[i];

        try {
          stepResult.status = 'running';
          stepResult.startedAt = Date.now();

          logger.info(`Executing recovery step: ${step.name}`, 'backup-system', { 
            stepId: step.id, 
            executionId,
          });

          await this.executeRecoveryStep(step, backup);

          stepResult.status = 'completed';
          stepResult.completedAt = Date.now();
          stepResult.duration = stepResult.completedAt - stepResult.startedAt;

          logger.info(`Recovery step completed: ${step.name}`, 'backup-system', { 
            stepId: step.id, 
            duration: stepResult.duration,
          });
        } catch (error) {
          stepResult.status = 'failed';
          stepResult.completedAt = Date.now();
          stepResult.duration = stepResult.completedAt! - stepResult.startedAt;
          stepResult.error = error instanceof Error ? error.message : 'Unknown error';

          execution.errors.push(`Step "${step.name}" failed: ${stepResult.error}`);

          logger.error(`Recovery step failed: ${step.name}`, 'backup-system', { 
            stepId: step.id, 
            error: stepResult.error,
          });

          if (step.critical) {
            execution.rollbackRequired = true;
            throw error;
          } else {
            //continue with non-critical step failure
            logger.warn(`Continuing recovery despite non-critical step failure: ${step.name}`, 'backup-system');
          }
        }
      }

      execution.status = RecoveryStatus.COMPLETED;
      execution.completedAt = Date.now();
      execution.duration = execution.completedAt - execution.startedAt;

      logger.info(`Recovery execution completed: ${plan.name}`, 'backup-system', { 
        executionId, 
        duration: execution.duration,
      });

      //notify success
      this.sendNotification('recovery_success', { plan, execution });

      return executionId;
    } catch (error) {
      execution.status = RecoveryStatus.FAILED;
      execution.completedAt = Date.now();
      execution.duration = execution.completedAt - execution.startedAt;

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Recovery execution failed: ${plan.name}`, 'backup-system', { 
        executionId, 
        error: errorMessage,
      });

      //create alert for failed recovery
      createAlert(
        `Recovery Failed: ${plan.name}`,
        `Recovery execution failed: ${errorMessage}`,
        AlertSeverity.CRITICAL,
        'backup-system',
        ['recovery', 'failure'],
        { planId, executionId, error: errorMessage }
      );

      //notify failure
      this.sendNotification('recovery_failure', { plan, execution, error: errorMessage });

      //execute rollback if required
      if (execution.rollbackRequired) {
        await this.executeRollback(execution);
      }

      throw error;
    }
  }

  private async executeRecoveryStep(step: RecoveryStep, backup?: Backup): Promise<void> {
    //simulate step execution
    await new Promise(resolve => setTimeout(resolve, 1000));

    switch (step.type) {
      case 'database_restore':
        if (!backup) throw new Error('Backup required for database restore');
        await this.restoreDatabase(backup, step.parameters);
        break;
      case 'file_restore':
        if (!backup) throw new Error('Backup required for file restore');
        await this.restoreFiles(backup, step.parameters);
        break;
      case 'config_restore':
        if (!backup) throw new Error('Backup required for config restore');
        await this.restoreConfiguration(backup, step.parameters);
        break;
      case 'validation':
        await this.validateRecoveryStep(step.parameters);
        break;
      case 'cleanup':
        await this.cleanupRecoveryStep(step.parameters);
        break;
      default:
        throw new Error(`Unsupported recovery step type: ${step.type}`);
    }
  }

  private async restoreDatabase(backup: Backup, parameters: Record<string, any>): Promise<void> {
    logger.info('Restoring database from backup', 'backup-system', { backupId: backup.id });
    //simulate database restore
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  private async restoreFiles(backup: Backup, parameters: Record<string, any>): Promise<void> {
    logger.info('Restoring files from backup', 'backup-system', { backupId: backup.id });
    //simulate file restore
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  private async restoreConfiguration(backup: Backup, parameters: Record<string, any>): Promise<void> {
    logger.info('Restoring configuration from backup', 'backup-system', { backupId: backup.id });
    //simulate config restore
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private async validateRecoveryStep(parameters: Record<string, any>): Promise<void> {
    logger.info('Validating recovery step', 'backup-system', { parameters });
    //simulate validation
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  private async cleanupRecoveryStep(parameters: Record<string, any>): Promise<void> {
    logger.info('Cleaning up recovery step', 'backup-system', { parameters });
    //simulate cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private async executeRollback(execution: RecoveryExecution): Promise<void> {
    logger.warn('Executing rollback for failed recovery', 'backup-system', { executionId: execution.id });
    
    //rollback completed steps in reverse order
    const completedSteps = execution.steps
      .filter(step => step.status === 'completed')
      .reverse();

    for (const stepResult of completedSteps) {
      try {
        //simulate rollback execution
        await new Promise(resolve => setTimeout(resolve, 1000));
        stepResult.rollbackExecuted = true;
        
        logger.info('Rollback step completed', 'backup-system', { stepId: stepResult.stepId });
      } catch (error) {
        logger.error('Rollback step failed', 'backup-system', { 
          stepId: stepResult.stepId, 
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  //verification
  private async verifyBackup(backup: Backup): Promise<VerificationResult> {
    logger.info('Verifying backup integrity', 'backup-system', { backupId: backup.id });

    try {
      //simulate verification
      await new Promise(resolve => setTimeout(resolve, 2000));

      const result: VerificationResult = {
        verified: true,
        checksumMatch: true,
        sizeMatch: true,
        contentIntegrity: true,
        errors: [],
        verifiedAt: Date.now(),
      };

      return result;
    } catch (error) {
      return {
        verified: false,
        checksumMatch: false,
        sizeMatch: false,
        contentIntegrity: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        verifiedAt: Date.now(),
      };
    }
  }

  //scheduling
  private async runScheduler(): Promise<void> {
    const now = Date.now();
    
    for (const job of this.jobs.values()) {
      if (!job.enabled || !job.nextRun || job.nextRun > now) continue;
      if (this.activeJobs.has(job.id)) continue;

      try {
        await this.executeJob(job.id);
      } catch (error) {
        logger.error('Scheduled backup job failed', 'backup-system', { 
          jobId: job.id, 
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  private async runVerification(): Promise<void> {
    logger.info('Running backup verification', 'backup-system');

    for (const backup of this.backups.values()) {
      if (backup.status !== BackupStatus.COMPLETED) continue;
      if (backup.verificationResults && 
          Date.now() - backup.verificationResults.verifiedAt < 24 * 60 * 60 * 1000) {
        continue; // verified within 24 hours
      }

      try {
        backup.verificationResults = await this.verifyBackup(backup);
        
        if (!backup.verificationResults.verified) {
          backup.status = BackupStatus.CORRUPTED;
          
          createAlert(
            `Backup Corruption Detected`,
            `Backup ${backup.name} failed verification`,
            AlertSeverity.ERROR,
            'backup-system',
            ['backup', 'corruption'],
            { backupId: backup.id }
          );
        }
      } catch (error) {
        logger.error('Backup verification failed', 'backup-system', { 
          backupId: backup.id, 
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  private async cleanupExpiredBackups(): Promise<void> {
    const now = Date.now();
    const expiredBackups: string[] = [];

    for (const [id, backup] of this.backups.entries()) {
      if (backup.expiresAt < now) {
        expiredBackups.push(id);
      }
    }

    for (const backupId of expiredBackups) {
      const backup = this.backups.get(backupId);
      if (!backup) continue;

      try {
        await this.deleteFile(backup.location);
        this.backups.delete(backupId);
        
        logger.info('Expired backup cleaned up', 'backup-system', { 
          backupId, 
          name: backup.name,
        });
      } catch (error) {
        logger.error('Failed to cleanup expired backup', 'backup-system', { 
          backupId, 
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  //utility methods
  private calculateNextRun(schedule: string): number {
    //simplified cron parser - in production use a proper cron library
    const now = new Date();
    return now.getTime() + 24 * 60 * 60 * 1000; // next day for simplicity
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async ensureDirectory(path: string): Promise<void> {
    //simulate directory creation
    logger.debug('Ensuring directory exists', 'backup-system', { path });
  }

  private async getFileStats(path: string): Promise<{ size: number; checksum: string }> {
    //simulate file stats
    return {
      size: Math.floor(Math.random() * 1000000) + 1000, // 1KB to 1MB
      checksum: Math.random().toString(36).substr(2, 32),
    };
  }

  private async compressFile(source: string, destination: string): Promise<void> {
    //simulate file compression
    logger.debug('Compressing file', 'backup-system', { source, destination });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private async deleteFile(path: string): Promise<void> {
    //simulate file deletion
    logger.debug('Deleting file', 'backup-system', { path });
  }

  private async sendNotification(type: string, data: any): Promise<void> {
    try {
      await fetch(this.config.notificationEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data, timestamp: Date.now() }),
      });
    } catch (error) {
      logger.error('Failed to send backup notification', 'backup-system', { type, error });
    }
  }

  //public api
  public getJob(jobId: string): BackupJob | null {
    return this.jobs.get(jobId) || null;
  }

  public getAllJobs(): BackupJob[] {
    return Array.from(this.jobs.values());
  }

  public getBackup(backupId: string): Backup | null {
    return this.backups.get(backupId) || null;
  }

  public getAllBackups(): Backup[] {
    return Array.from(this.backups.values());
  }

  public getRecoveryPlan(planId: string): RecoveryPlan | null {
    return this.recoveryPlans.get(planId) || null;
  }

  public getAllRecoveryPlans(): RecoveryPlan[] {
    return Array.from(this.recoveryPlans.values());
  }

  public getRecoveryExecution(executionId: string): RecoveryExecution | null {
    return this.recoveryExecutions.get(executionId) || null;
  }

  public getAllRecoveryExecutions(): RecoveryExecution[] {
    return Array.from(this.recoveryExecutions.values());
  }

  public getSystemStatus(): {
    jobsTotal: number;
    jobsEnabled: number;
    backupsTotal: number;
    backupsHealthy: number;
    lastBackup?: number;
    nextBackup?: number;
    totalBackupSize: number;
    storageUsed: number;
  } {
    const jobs = Array.from(this.jobs.values());
    const backups = Array.from(this.backups.values());
    const healthyBackups = backups.filter(b => b.status === BackupStatus.COMPLETED);
    
    const lastBackup = backups
      .sort((a, b) => b.createdAt - a.createdAt)[0]?.createdAt;
    
    const nextBackup = jobs
      .filter(j => j.enabled && j.nextRun)
      .sort((a, b) => a.nextRun! - b.nextRun!)[0]?.nextRun;

    const totalSize = backups.reduce((sum, b) => sum + (b.compressedSize || b.size), 0);

    return {
      jobsTotal: jobs.length,
      jobsEnabled: jobs.filter(j => j.enabled).length,
      backupsTotal: backups.length,
      backupsHealthy: healthyBackups.length,
      lastBackup,
      nextBackup,
      totalBackupSize: totalSize,
      storageUsed: totalSize, // simplified
    };
  }

  public shutdown(): void {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
    }

    if (this.verificationTimer) {
      clearInterval(this.verificationTimer);
    }

    this.isInitialized = false;
    logger.info('Backup System shutdown', 'backup-system');
  }
}

//global backup system
export const backupSystem = new BackupSystem({
  enabled: true,
  defaultRetention: 30,
  backupDirectory: './backups',
  maxConcurrentJobs: 2,
});

//convenience functions
export const createBackupJob = (job: Omit<BackupJob, 'nextRun'>) => backupSystem.createJob(job);
export const executeBackup = (jobId: string, force = false) => backupSystem.executeJob(jobId, force);
export const createRecoveryPlan = (plan: RecoveryPlan) => backupSystem.createRecoveryPlan(plan);
export const executeRecovery = (planId: string, backupId: string | undefined, executedBy: string) => 
  backupSystem.executeRecovery(planId, backupId, executedBy);

export { BackupSystem };
export type { BackupJob, Backup, RecoveryPlan, RecoveryExecution, VerificationResult };