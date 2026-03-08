#!/usr/bin/env tsx
/**
 * PHI Access Audit Script
 * 
 * Checks recent PHI access patterns and identifies potential security issues.
 * 
 * Usage:
 *   npx tsx scripts/check-phi-access.ts [options]
 * 
 * Options:
 *   --hours=<n>     Check last n hours (default: 24)
 *   --limit=<n>     Maximum log entries to analyze (default: 1000)
 *   --user=<id>     Filter by specific user ID
 *   --export=<file> Export results to JSON file
 */

import { prisma } from '../lib/db/prisma';
import { AuditEventType, PHIResourceType } from '../lib/audit/types';

// CLI Arguments parsing
const args = process.argv.slice(2);
const options = {
  hours: 24,
  limit: 1000,
  userId: undefined as string | undefined,
  exportFile: undefined as string | undefined,
};

for (const arg of args) {
  if (arg.startsWith('--hours=')) {
    options.hours = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--limit=')) {
    options.limit = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--user=')) {
    options.userId = arg.split('=')[1];
  } else if (arg.startsWith('--export=')) {
    options.exportFile = arg.split('=')[1];
  }
}

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

// Analysis results
interface PHIAccessAnalysis {
  summary: {
    totalEvents: number;
    successfulAccess: number;
    failedAccess: number;
    uniqueUsers: number;
    uniqueResources: number;
    timeRange: { start: Date; end: Date };
  };
  byEventType: Record<string, number>;
  byResourceType: Record<string, number>;
  byUser: Array<{
    userId: string;
    userRole: string;
    accessCount: number;
    resourcesAccessed: string[];
  }>;
  suspiciousActivity: Array<{
    type: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
    details: unknown;
  }>;
  topAccessedResources: Array<{
    resourceType: string;
    resourceId: string;
    accessCount: number;
  }>;
}

/**
 * Fetch audit logs from database
 */
async function fetchAuditLogs(): Promise<unknown[]> {
  const since = new Date(Date.now() - options.hours * 60 * 60 * 1000);
  
  console.log(`${colors.cyan}Fetching audit logs from last ${options.hours} hours...${colors.reset}`);

  const where: Record<string, unknown> = {
    timestamp: {
      gte: since,
    },
  };

  if (options.userId) {
    where.userId = options.userId;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: options.limit,
  });

  console.log(`${colors.green}Retrieved ${logs.length} audit log entries${colors.reset}`);
  return logs;
}

/**
 * Analyze PHI access patterns
 */
function analyzePHIAccess(logs: unknown[]): PHIAccessAnalysis {
  const analysis: PHIAccessAnalysis = {
    summary: {
      totalEvents: logs.length,
      successfulAccess: 0,
      failedAccess: 0,
      uniqueUsers: 0,
      uniqueResources: 0,
      timeRange: { start: new Date(), end: new Date(0) },
    },
    byEventType: {},
    byResourceType: {},
    byUser: [],
    suspiciousActivity: [],
    topAccessedResources: [],
  };

  const userAccessMap = new Map<string, { userRole: string; count: number; resources: Set<string> }>();
  const resourceAccessMap = new Map<string, { type: string; count: number }>();
  const userFailedAttempts = new Map<string, number>();

  for (const log of logs as { 
    eventType: string; 
    success: boolean; 
    userId: string | null; 
    userRole: string | null;
    resourceType: string;
    resourceId: string | null;
    timestamp: Date;
    ipAddress: string;
    metadata?: Record<string, unknown>;
  }[]) {
    // Update time range
    if (log.timestamp < analysis.summary.timeRange.start) {
      analysis.summary.timeRange.start = log.timestamp;
    }
    if (log.timestamp > analysis.summary.timeRange.end) {
      analysis.summary.timeRange.end = log.timestamp;
    }

    // Count success/failure
    if (log.success) {
      analysis.summary.successfulAccess++;
    } else {
      analysis.summary.failedAccess++;
      if (log.userId) {
        userFailedAttempts.set(log.userId, (userFailedAttempts.get(log.userId) || 0) + 1);
      }
    }

    // Count by event type
    analysis.byEventType[log.eventType] = (analysis.byEventType[log.eventType] || 0) + 1;

    // Count by resource type
    if (log.resourceType) {
      analysis.byResourceType[log.resourceType] = (analysis.byResourceType[log.resourceType] || 0) + 1;
    }

    // Track user access
    if (log.userId) {
      const existing = userAccessMap.get(log.userId);
      if (existing) {
        existing.count++;
        if (log.resourceId) {
          existing.resources.add(`${log.resourceType}:${log.resourceId}`);
        }
      } else {
        userAccessMap.set(log.userId, {
          userRole: log.userRole || 'unknown',
          count: 1,
          resources: log.resourceId ? new Set([`${log.resourceType}:${log.resourceId}`]) : new Set(),
        });
      }
    }

    // Track resource access
    if (log.resourceId) {
      const key = `${log.resourceType}:${log.resourceId}`;
      const existing = resourceAccessMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        resourceAccessMap.set(key, { type: log.resourceType, count: 1 });
      }
    }

    // Check for suspicious activity
    checkForSuspiciousActivity(log, analysis);
  }

  // Calculate unique counts
  analysis.summary.uniqueUsers = userAccessMap.size;
  analysis.summary.uniqueResources = resourceAccessMap.size;

  // Convert user map to array
  analysis.byUser = Array.from(userAccessMap.entries())
    .map(([userId, data]) => ({
      userId,
      userRole: data.userRole,
      accessCount: data.count,
      resourcesAccessed: Array.from(data.resources),
    }))
    .sort((a, b) => b.accessCount - a.accessCount);

  // Convert resource map to array
  analysis.topAccessedResources = Array.from(resourceAccessMap.entries())
    .map(([key, data]) => ({
      resourceType: data.type,
      resourceId: key.split(':')[1],
      accessCount: data.count,
    }))
    .sort((a, b) => b.accessCount - a.accessCount)
    .slice(0, 10);

  // Check for brute force patterns
  for (const [userId, failedCount] of userFailedAttempts.entries()) {
    if (failedCount >= 5) {
      analysis.suspiciousActivity.push({
        type: 'BRUTE_FORCE_ATTEMPTS',
        severity: 'HIGH',
        description: `User ${userId} has ${failedCount} failed access attempts`,
        details: { userId, failedCount },
      });
    }
  }

  return analysis;
}

/**
 * Check for suspicious activity patterns
 */
function checkForSuspiciousActivity(
  log: { 
    eventType: string; 
    success: boolean; 
    userId: string | null; 
    userRole: string | null;
    metadata?: Record<string, unknown>;
    ipAddress: string;
  },
  analysis: PHIAccessAnalysis
): void {
  // Check for emergency/break-glass access
  if (log.metadata?.emergencyAccess || log.metadata?.breakGlass) {
    analysis.suspiciousActivity.push({
      type: 'EMERGENCY_ACCESS',
      severity: 'HIGH',
      description: `Emergency access detected for user ${log.userId}`,
      details: { userId: log.userId, timestamp: log.metadata },
    });
  }

  // Check for access outside normal hours (10 PM - 6 AM)
  const hour = new Date().getHours();
  if (hour >= 22 || hour < 6) {
    // Only flag if it's PHI access
    if (log.eventType.includes('VIEWED') || log.eventType.includes('DATA')) {
      analysis.suspiciousActivity.push({
        type: 'AFTER_HOURS_ACCESS',
        severity: 'LOW',
        description: `After-hours PHI access by user ${log.userId}`,
        details: { userId: log.userId, hour, eventType: log.eventType },
      });
    }
  }

  // Check for admin accessing patient data (should be logged)
  if (log.userRole === 'ADMIN' && log.eventType.includes('PATIENT_DATA')) {
    analysis.suspiciousActivity.push({
      type: 'ADMIN_PHI_ACCESS',
      severity: 'MEDIUM',
      description: `Admin accessing patient data: ${log.userId}`,
      details: { userId: log.userId, resourceId: log.metadata },
    });
  }
}

/**
 * Print analysis results
 */
function printAnalysis(analysis: PHIAccessAnalysis): void {
  console.log(`\n${colors.bold}${'='.repeat(70)}${colors.reset}`);
  console.log(`${colors.bold}PHI ACCESS ANALYSIS REPORT${colors.reset}`);
  console.log(`${colors.bold}${'='.repeat(70)}${colors.reset}`);

  // Summary
  console.log(`\n${colors.bold}Summary:${colors.reset}`);
  console.log(`  Total Events:        ${analysis.summary.totalEvents}`);
  console.log(`  Successful Access:   ${colors.green}${analysis.summary.successfulAccess}${colors.reset}`);
  console.log(`  Failed Access:       ${analysis.summary.failedAccess > 0 ? colors.red : colors.green}${analysis.summary.failedAccess}${colors.reset}`);
  console.log(`  Unique Users:        ${analysis.summary.uniqueUsers}`);
  console.log(`  Unique Resources:    ${analysis.summary.uniqueResources}`);
  console.log(`  Time Range:          ${analysis.summary.timeRange.start.toISOString()} to ${analysis.summary.timeRange.end.toISOString()}`);

  // Event Types
  console.log(`\n${colors.bold}Events by Type:${colors.reset}`);
  for (const [type, count] of Object.entries(analysis.byEventType).sort((a, b) => b[1] - a[1])) {
    const color = type.includes('FAILED') ? colors.red : colors.green;
    console.log(`  ${color}${type.padEnd(30)}${count.toString().padStart(5)}${colors.reset}`);
  }

  // Resource Types
  console.log(`\n${colors.bold}Access by Resource Type:${colors.reset}`);
  for (const [type, count] of Object.entries(analysis.byResourceType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type.padEnd(30)}${count.toString().padStart(5)}`);
  }

  // Top Users
  console.log(`\n${colors.bold}Top 10 Users by Access Count:${colors.reset}`);
  for (const user of analysis.byUser.slice(0, 10)) {
    const roleColor = user.userRole === 'ADMIN' ? colors.yellow : user.userRole === 'PHYSICIAN' ? colors.cyan : colors.green;
    console.log(`  ${roleColor}${user.userId.substring(0, 8)}...${colors.reset} (${roleColor}${user.userRole}${colors.reset}): ${user.accessCount} accesses, ${user.resourcesAccessed.length} resources`);
  }

  // Top Resources
  console.log(`\n${colors.bold}Top 10 Accessed Resources:${colors.reset}`);
  for (const resource of analysis.topAccessedResources) {
    console.log(`  ${resource.resourceType.padEnd(20)} ${resource.resourceId?.substring(0, 8)}... : ${resource.accessCount} accesses`);
  }

  // Suspicious Activity
  console.log(`\n${colors.bold}Suspicious Activity:${colors.reset}`);
  if (analysis.suspiciousActivity.length === 0) {
    console.log(`  ${colors.green}No suspicious activity detected${colors.reset}`);
  } else {
    for (const activity of analysis.suspiciousActivity) {
      const severityColor = activity.severity === 'HIGH' ? colors.red : activity.severity === 'MEDIUM' ? colors.yellow : colors.blue;
      console.log(`  ${severityColor}[${activity.severity}] ${activity.type}${colors.reset}`);
      console.log(`    ${activity.description}`);
    }
  }

  console.log(`\n${colors.bold}${'='.repeat(70)}${colors.reset}`);
}

/**
 * Export results to file
 */
import { writeFileSync } from 'fs';

function exportResults(analysis: PHIAccessAnalysis, filename: string): void {
  const data = {
    generatedAt: new Date().toISOString(),
    options,
    analysis,
  };
  writeFileSync(filename, JSON.stringify(data, null, 2));
  console.log(`\n${colors.green}Results exported to: ${filename}${colors.reset}`);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log(`${colors.bold}${colors.cyan}`);
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           PHI ACCESS AUDIT                                   ║');
  console.log('║           HIPAA-Compliant Access Monitoring                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);

  console.log(`\n${colors.gray}Options:${colors.reset}`);
  console.log(`  Hours:    ${options.hours}`);
  console.log(`  Limit:    ${options.limit}`);
  console.log(`  User ID:  ${options.userId || '(all users)'}`);
  console.log(`  Export:   ${options.exportFile || '(none)'}\n`);

  try {
    const logs = await fetchAuditLogs();
    const analysis = analyzePHIAccess(logs);
    printAnalysis(analysis);

    if (options.exportFile) {
      exportResults(analysis, options.exportFile);
    }

    // Exit with error code if suspicious activity found
    const highSeverityCount = analysis.suspiciousActivity.filter(a => a.severity === 'HIGH').length;
    if (highSeverityCount > 0) {
      console.log(`\n${colors.red}${colors.bold}⚠️  ${highSeverityCount} HIGH severity issues detected${colors.reset}`);
      process.exit(1);
    }

    console.log(`\n${colors.green}${colors.bold}✅ Audit completed successfully${colors.reset}`);
    process.exit(0);
  } catch (error) {
    console.error(`\n${colors.red}${colors.bold}❌ Audit failed:${colors.reset}`, error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run main
main();
