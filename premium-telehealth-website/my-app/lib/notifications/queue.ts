/**
 * Redis-based Notification Queue
 * 
 * Implements a robust job queue for email and SMS notifications
 * using Redis data structures for persistence and scheduling.
 * 
 * Redis Schema:
 * - notifications:pending (List) - Jobs waiting to be processed
 * - notifications:processing (Hash) - Jobs currently being processed
 * - notifications:completed (List) - Successfully completed jobs (limited retention)
 * - notifications:failed (List) - Failed jobs
 * - notifications:scheduled (Sorted Set) - Jobs scheduled for future execution
 * - notifications:job:{id} (Hash) - Individual job data
 * 
 * HIPAA Compliance Notes:
 * - Job IDs are random, not sequential (no info leakage)
 * - Job data contains recipient identifiers but logs don't
 * - Failed jobs are retained for audit/debugging
 * 
 * @module lib/notifications/queue
 */

import { getRedisClient } from '@/lib/redis/client';
import { sendEmail } from '@/lib/integrations/sendgrid';
import { sendSMS } from '@/lib/integrations/twilio';
import { EmailTemplate, SMSTemplate } from './templates';

/**
 * Job status types
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'scheduled';

/**
 * Notification job types
 */
export type NotificationType = 'email' | 'sms';

/**
 * Priority levels for notifications
 */
export type NotificationPriority = 'high' | 'normal' | 'low';

/**
 * Email job payload
 */
export interface EmailJobPayload {
  to: string;
  template: EmailTemplate;
  data: Record<string, string>;
  from?: string;
}

/**
 * SMS job payload
 */
export interface SMSJobPayload {
  to: string;
  template: SMSTemplate;
  data: Record<string, string>;
  body?: string;
  from?: string;
}

/**
 * Notification job definition
 */
export interface NotificationJob {
  /** Unique job identifier (auto-generated if not provided) */
  id?: string;
  /** Type of notification */
  type: NotificationType;
  /** Priority level (default: normal) */
  priority?: NotificationPriority;
  /** Job payload */
  payload: EmailJobPayload | SMSJobPayload;
  /** Optional: schedule for future execution */
  scheduledFor?: Date;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Current attempt number (auto-managed) */
  attempt?: number;
  /** Job creation timestamp (auto-set) */
  createdAt?: string;
}

/**
 * Job data stored in Redis
 */
interface StoredJob extends NotificationJob {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

/**
 * Priority score mapping (higher = more urgent)
 */
const PRIORITY_SCORES: Record<NotificationPriority, number> = {
  high: 3,
  normal: 2,
  low: 1,
};

/**
 * Redis key prefixes
 */
const KEYS = {
  PENDING: 'notifications:pending',
  PROCESSING: 'notifications:processing',
  COMPLETED: 'notifications:completed',
  FAILED: 'notifications:failed',
  SCHEDULED: 'notifications:scheduled',
  JOB: (id: string) => `notifications:job:${id}`,
  STATS: 'notifications:stats',
} as const;

/**
 * Generate unique job ID
 */
function generateJobId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Notification Queue Manager
 * 
 * Provides methods for adding, processing, and managing notification jobs
 */
export class NotificationQueue {
  /**
   * Add a job to the queue
   * 
   * @param job - Notification job to add
   * @returns Job ID
   * 
   * @example
   * ```typescript
   * const jobId = await notificationQueue.add({
   *   type: 'email',
   *   priority: 'high',
   *   payload: {
   *     to: 'user@example.com',
   *     template: EmailTemplate.WELCOME,
   *     data: { firstName: 'John' },
   *   },
   * });
   * ```
   */
  async add(job: NotificationJob): Promise<string> {
    const redis = getRedisClient();
    
    const jobId = job.id || generateJobId();
    const now = new Date().toISOString();
    
    const storedJob: StoredJob = {
      ...job,
      id: jobId,
      priority: job.priority || 'normal',
      maxRetries: job.maxRetries ?? 3,
      attempt: job.attempt ?? 0,
      status: job.scheduledFor && job.scheduledFor > new Date() ? 'scheduled' : 'pending',
      createdAt: now,
      updatedAt: now,
    };

    try {
      // Store job data
      await redis.hset(KEYS.JOB(jobId), this.serializeJob(storedJob));

      if (storedJob.status === 'scheduled') {
        // Add to scheduled sorted set with timestamp as score
        const score = job.scheduledFor!.getTime();
        await redis.zadd(KEYS.SCHEDULED, score, jobId);
        console.log(`[NotificationQueue] Job ${jobId} scheduled for ${job.scheduledFor!.toISOString()}`);
      } else {
        // Add to pending list with priority
        const priorityScore = PRIORITY_SCORES[storedJob.priority ?? 'normal'];
        await redis.zadd(KEYS.PENDING, priorityScore, jobId);
        console.log(`[NotificationQueue] Job ${jobId} added to pending queue`);
      }

      // Update stats
      await redis.hincrby(KEYS.STATS, `${storedJob.type}_queued`, 1);

      return jobId;
    } catch (error) {
      console.error('[NotificationQueue] Failed to add job:', error);
      throw error;
    }
  }

  /**
   * Process jobs from the queue
   * Should be called by a background worker
   * 
   * @param batchSize - Number of jobs to process (default: 10)
   * @returns Promise<void>
   * 
   * @example
   * ```typescript
   * // Process batch of jobs
   * await notificationQueue.process();
   * 
   * // Run continuously in background
   * setInterval(() => notificationQueue.process(), 5000);
   * ```
   */
  async process(batchSize: number = 10): Promise<void> {
    const redis = getRedisClient();

    try {
      // First, move any scheduled jobs that are ready to pending
      await this.processScheduledJobs();

      // Get jobs from pending queue (highest priority first)
      const jobIds = await redis.zrevrange(KEYS.PENDING, 0, batchSize - 1);

      if (jobIds.length === 0) return;

      console.log(`[NotificationQueue] Processing ${jobIds.length} jobs`);

      for (const jobId of jobIds) {
        // Remove from pending
        await redis.zrem(KEYS.PENDING, jobId);

        // Get job data
        const jobData = await redis.hgetall(KEYS.JOB(jobId));
        if (!jobData || Object.keys(jobData).length === 0) {
          console.error(`[NotificationQueue] Job ${jobId} not found`);
          continue;
        }

        const job = this.deserializeJob(jobData);

        // Move to processing
        job.status = 'processing';
        job.updatedAt = new Date().toISOString();
        await redis.hset(KEYS.JOB(jobId), this.serializeJob(job));
        await redis.hset(KEYS.PROCESSING, jobId, JSON.stringify({ startedAt: new Date().toISOString() }));

        try {
          // Process the job
          await this.executeJob(job);

          // Mark as completed
          job.status = 'completed';
          job.updatedAt = new Date().toISOString();
          await redis.hset(KEYS.JOB(jobId), this.serializeJob(job));
          
          // Remove from processing
          await redis.hdel(KEYS.PROCESSING, jobId);
          
          // Add to completed list (with TTL)
          await redis.lpush(KEYS.COMPLETED, jobId);
          await redis.ltrim(KEYS.COMPLETED, 0, 999); // Keep last 1000
          
          // Update stats
          await redis.hincrby(KEYS.STATS, `${job.type}_sent`, 1);
          
          console.log(`[NotificationQueue] Job ${jobId} completed successfully`);
        } catch (error) {
          // Handle failure
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          job.error = errorMessage;
          job.attempt = (job.attempt ?? 0) + 1;

          if (job.attempt < (job.maxRetries ?? 3)) {
            // Retry with exponential backoff
            job.status = 'pending';
            job.updatedAt = new Date().toISOString();
            await redis.hset(KEYS.JOB(jobId), this.serializeJob(job));
            
            // Re-queue with delay
            const delayMs = Math.pow(2, job.attempt) * 1000; // Exponential backoff
            setTimeout(async () => {
              await redis.zadd(KEYS.PENDING, PRIORITY_SCORES[job.priority ?? 'normal'], jobId);
            }, delayMs);
            
            console.log(`[NotificationQueue] Job ${jobId} failed, retrying (${job.attempt}/${job.maxRetries})`);
          } else {
            // Max retries reached, mark as failed
            job.status = 'failed';
            job.updatedAt = new Date().toISOString();
            await redis.hset(KEYS.JOB(jobId), this.serializeJob(job));
            
            // Remove from processing
            await redis.hdel(KEYS.PROCESSING, jobId);
            
            // Add to failed list
            await redis.lpush(KEYS.FAILED, jobId);
            
            // Update stats
            await redis.hincrby(KEYS.STATS, `${job.type}_failed`, 1);
            
            console.error(`[NotificationQueue] Job ${jobId} failed after ${job.maxRetries} attempts: ${errorMessage}`);
          }
        }
      }
    } catch (error) {
      console.error('[NotificationQueue] Error processing queue:', error);
    }
  }

  /**
   * Execute a notification job
   * 
   * @param job - Job to execute
   */
  private async executeJob(job: StoredJob): Promise<void> {
    if (job.type === 'email') {
      const payload = job.payload as EmailJobPayload;
      await sendEmail({
        to: payload.to,
        template: payload.template,
        data: payload.data,
        from: payload.from,
      });
    } else if (job.type === 'sms') {
      const payload = job.payload as SMSJobPayload;
      await sendSMS({
        to: payload.to,
        template: payload.template,
        data: payload.data,
        body: payload.body,
        from: payload.from,
      });
    } else {
      throw new Error(`Unknown job type: ${job.type}`);
    }
  }

  /**
   * Move scheduled jobs that are ready to the pending queue
   */
  private async processScheduledJobs(): Promise<void> {
    const redis = getRedisClient();
    const now = Date.now();

    try {
      // Get jobs scheduled for now or earlier
      const jobIds = await redis.zrangebyscore(KEYS.SCHEDULED, 0, now);

      for (const jobId of jobIds) {
        // Remove from scheduled
        await redis.zrem(KEYS.SCHEDULED, jobId);

        // Update job status
        const jobData = await redis.hgetall(KEYS.JOB(jobId));
        if (jobData && Object.keys(jobData).length > 0) {
          const job = this.deserializeJob(jobData);
          job.status = 'pending';
          job.updatedAt = new Date().toISOString();
          await redis.hset(KEYS.JOB(jobId), this.serializeJob(job));

          // Add to pending queue
          const priorityScore = PRIORITY_SCORES[job.priority ?? 'normal'];
          await redis.zadd(KEYS.PENDING, priorityScore, jobId);
        }
      }

      if (jobIds.length > 0) {
        console.log(`[NotificationQueue] Moved ${jobIds.length} scheduled jobs to pending`);
      }
    } catch (error) {
      console.error('[NotificationQueue] Error processing scheduled jobs:', error);
    }
  }

  /**
   * Get job status by ID
   * 
   * @param jobId - Job identifier
   * @returns Job status or null if not found
   * 
   * @example
   * ```typescript
   * const status = await notificationQueue.getJobStatus('notif-123...');
   * console.log(status); // 'pending' | 'processing' | 'completed' | 'failed'
   * ```
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const redis = getRedisClient();

    try {
      const jobData = await redis.hgetall(KEYS.JOB(jobId));
      if (!jobData || Object.keys(jobData).length === 0) {
        return null;
      }

      return jobData.status as JobStatus;
    } catch (error) {
      console.error('[NotificationQueue] Error getting job status:', error);
      return null;
    }
  }

  /**
   * Get full job details by ID
   * 
   * @param jobId - Job identifier
   * @returns Job data or null if not found
   */
  async getJob(jobId: string): Promise<StoredJob | null> {
    const redis = getRedisClient();

    try {
      const jobData = await redis.hgetall(KEYS.JOB(jobId));
      if (!jobData || Object.keys(jobData).length === 0) {
        return null;
      }

      return this.deserializeJob(jobData);
    } catch (error) {
      console.error('[NotificationQueue] Error getting job:', error);
      return null;
    }
  }

  /**
   * Retry a failed job
   * 
   * @param jobId - Job identifier
   * @returns Promise<void>
   * 
   * @example
   * ```typescript
   * await notificationQueue.retry('notif-123...');
   * ```
   */
  async retry(jobId: string): Promise<void> {
    const redis = getRedisClient();

    try {
      const jobData = await redis.hgetall(KEYS.JOB(jobId));
      if (!jobData || Object.keys(jobData).length === 0) {
        throw new Error(`Job ${jobId} not found`);
      }

      const job = this.deserializeJob(jobData);

      if (job.status !== 'failed') {
        throw new Error(`Job ${jobId} is not in failed status`);
      }

      // Reset for retry
      job.status = 'pending';
      job.attempt = 0;
      job.error = undefined;
      job.updatedAt = new Date().toISOString();

      await redis.hset(KEYS.JOB(jobId), this.serializeJob(job));

      // Remove from failed list
      await redis.lrem(KEYS.FAILED, 0, jobId);

      // Add to pending queue
      const priorityScore = PRIORITY_SCORES[job.priority ?? 'normal'];
      await redis.zadd(KEYS.PENDING, priorityScore, jobId);

      console.log(`[NotificationQueue] Job ${jobId} queued for retry`);
    } catch (error) {
      console.error('[NotificationQueue] Error retrying job:', error);
      throw error;
    }
  }

  /**
   * Cancel a pending or scheduled job
   * 
   * @param jobId - Job identifier
   * @returns Promise<boolean> - True if cancelled, false if not found or already processing
   */
  async cancel(jobId: string): Promise<boolean> {
    const redis = getRedisClient();

    try {
      const jobData = await redis.hgetall(KEYS.JOB(jobId));
      if (!jobData || Object.keys(jobData).length === 0) {
        return false;
      }

      const job = this.deserializeJob(jobData);

      if (job.status === 'processing' || job.status === 'completed') {
        return false;
      }

      // Remove from appropriate queue
      if (job.status === 'pending') {
        await redis.zrem(KEYS.PENDING, jobId);
      } else if (job.status === 'scheduled') {
        await redis.zrem(KEYS.SCHEDULED, jobId);
      }

      // Update status
      job.status = 'failed';
      job.error = 'Cancelled by user';
      job.updatedAt = new Date().toISOString();
      await redis.hset(KEYS.JOB(jobId), this.serializeJob(job));

      console.log(`[NotificationQueue] Job ${jobId} cancelled`);
      return true;
    } catch (error) {
      console.error('[NotificationQueue] Error cancelling job:', error);
      return false;
    }
  }

  /**
   * Clean up old jobs
   * 
   * @param maxAge - Maximum age in milliseconds (default: 7 days)
   * @returns Promise<number> - Number of jobs cleaned up
   * 
   * @example
   * ```typescript
   * // Clean up jobs older than 7 days
   * await notificationQueue.cleanup(7 * 24 * 60 * 60 * 1000);
   * ```
   */
  async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const redis = getRedisClient();
    const cutoff = Date.now() - maxAge;
    let cleaned = 0;

    try {
      // Clean up completed jobs
      const completedJobs = await redis.lrange(KEYS.COMPLETED, 0, -1);
      for (const jobId of completedJobs) {
        const jobData = await redis.hgetall(KEYS.JOB(jobId));
        if (jobData.createdAt) {
          const createdTime = new Date(jobData.createdAt).getTime();
          if (createdTime < cutoff) {
            await redis.del(KEYS.JOB(jobId));
            await redis.lrem(KEYS.COMPLETED, 0, jobId);
            cleaned++;
          }
        }
      }

      // Clean up failed jobs
      const failedJobs = await redis.lrange(KEYS.FAILED, 0, -1);
      for (const jobId of failedJobs) {
        const jobData = await redis.hgetall(KEYS.JOB(jobId));
        if (jobData.createdAt) {
          const createdTime = new Date(jobData.createdAt).getTime();
          if (createdTime < cutoff) {
            await redis.del(KEYS.JOB(jobId));
            await redis.lrem(KEYS.FAILED, 0, jobId);
            cleaned++;
          }
        }
      }

      console.log(`[NotificationQueue] Cleaned up ${cleaned} old jobs`);
      return cleaned;
    } catch (error) {
      console.error('[NotificationQueue] Error cleaning up jobs:', error);
      return cleaned;
    }
  }

  /**
   * Get queue statistics
   * 
   * @returns Queue statistics
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    scheduled: number;
    completed: number;
    failed: number;
    emailQueued: number;
    emailSent: number;
    emailFailed: number;
    smsQueued: number;
    smsSent: number;
    smsFailed: number;
  }> {
    const redis = getRedisClient();

    try {
      const [
        pending,
        processing,
        scheduled,
        completed,
        failed,
        stats,
      ] = await Promise.all([
        redis.zcard(KEYS.PENDING),
        redis.hlen(KEYS.PROCESSING),
        redis.zcard(KEYS.SCHEDULED),
        redis.llen(KEYS.COMPLETED),
        redis.llen(KEYS.FAILED),
        redis.hgetall(KEYS.STATS),
      ]);

      return {
        pending,
        processing,
        scheduled,
        completed,
        failed,
        emailQueued: parseInt(stats.email_queued || '0', 10),
        emailSent: parseInt(stats.email_sent || '0', 10),
        emailFailed: parseInt(stats.email_failed || '0', 10),
        smsQueued: parseInt(stats.sms_queued || '0', 10),
        smsSent: parseInt(stats.sms_sent || '0', 10),
        smsFailed: parseInt(stats.sms_failed || '0', 10),
      };
    } catch (error) {
      console.error('[NotificationQueue] Error getting stats:', error);
      return {
        pending: 0,
        processing: 0,
        scheduled: 0,
        completed: 0,
        failed: 0,
        emailQueued: 0,
        emailSent: 0,
        emailFailed: 0,
        smsQueued: 0,
        smsSent: 0,
        smsFailed: 0,
      };
    }
  }

  /**
   * Serialize job for Redis storage
   */
  private serializeJob(job: StoredJob): Record<string, string> {
    return {
      id: job.id,
      type: job.type,
      priority: job.priority ?? 'normal',
      payload: JSON.stringify(job.payload),
      maxRetries: (job.maxRetries ?? 3).toString(),
      attempt: (job.attempt ?? 0).toString(),
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      ...(job.scheduledFor && { scheduledFor: job.scheduledFor.toISOString() }),
      ...(job.error && { error: job.error }),
    };
  }

  /**
   * Deserialize job from Redis storage
   */
  private deserializeJob(data: Record<string, string>): StoredJob {
    return {
      id: data.id,
      type: data.type as NotificationType,
      priority: data.priority as NotificationPriority,
      payload: JSON.parse(data.payload),
      maxRetries: parseInt(data.maxRetries, 10),
      attempt: parseInt(data.attempt, 10),
      status: data.status as JobStatus,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      ...(data.scheduledFor && { scheduledFor: new Date(data.scheduledFor) }),
      ...(data.error && { error: data.error }),
    };
  }
}

/**
 * Global notification queue instance
 */
export const notificationQueue = new NotificationQueue();

export default notificationQueue;
