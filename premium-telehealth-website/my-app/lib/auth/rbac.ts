/**
 * Role-Based Access Control (RBAC)
 * Defines permissions for each role in the system
 * 
 * HIPAA Compliance: All access control decisions are logged via audit system
 * @see lib/audit/logger.ts
 */

import { Role } from '@prisma/client';

/**
 * Available permissions in the system
 * Grouped by functional domain for clarity
 */
export enum Permission {
  // ============================================
  // PATIENT SELF-SERVICE PERMISSIONS
  // ============================================
  
  /** View own patient profile (PHI) */
  VIEW_OWN_PROFILE = 'view_own_profile',
  
  /** Edit own patient profile (PHI) */
  EDIT_OWN_PROFILE = 'edit_own_profile',
  
  /** View own intake form data (PHI) */
  VIEW_OWN_INTAKE = 'view_own_intake',
  
  /** Create new intake form (PHI) */
  CREATE_INTAKE = 'create_intake',
  
  /** View own prescriptions (PHI) */
  VIEW_OWN_PRESCRIPTIONS = 'view_own_prescriptions',
  
  /** Request prescription refill */
  REQUEST_REFILL = 'request_refill',
  
  /** View messages in own threads (PHI) */
  VIEW_OWN_MESSAGES = 'view_own_messages',
  
  /** Send messages to assigned physician (PHI) */
  SEND_MESSAGE = 'send_message',
  
  /** View own uploaded documents (PHI) */
  VIEW_OWN_DOCUMENTS = 'view_own_documents',
  
  /** Upload new documents (PHI) */
  UPLOAD_DOCUMENT = 'upload_document',
  
  /** View own billing information */
  VIEW_OWN_BILLING = 'view_own_billing',
  
  /** Manage own subscription */
  MANAGE_SUBSCRIPTION = 'manage_subscription',
  
  /** Delete own account (GDPR/HIPAA right to deletion) */
  DELETE_OWN_ACCOUNT = 'delete_own_account',

  // ============================================
  // PHYSICIAN CLINICAL PERMISSIONS
  // ============================================
  
  /** View all patients list (names only, no PHI) */
  VIEW_ALL_PATIENTS = 'view_all_patients',
  
  /** View detailed patient information (PHI) */
  VIEW_PATIENT_DETAILS = 'view_patient_details',
  
  /** Review submitted intake forms (PHI) */
  REVIEW_INTAKE = 'review_intake',
  
  /** Approve intake and prescribe (PHI) */
  APPROVE_INTAKE = 'approve_intake',
  
  /** Reject intake with reason (PHI) */
  REJECT_INTAKE = 'reject_intake',
  
  /** Request additional information from patient (PHI) */
  REQUEST_INTAKE_INFO = 'request_intake_info',
  
  /** Create new prescription (PHI) */
  CREATE_PRESCRIPTION = 'create_prescription',
  
  /** Send prescription to pharmacy (PHI) */
  SEND_PRESCRIPTION = 'send_prescription',
  
  /** Cancel existing prescription (PHI) */
  CANCEL_PRESCRIPTION = 'cancel_prescription',
  
  /** View messages from assigned patients (PHI) */
  VIEW_PHYSICIAN_MESSAGES = 'view_physician_messages',
  
  /** Reply to patient messages (PHI) */
  REPLY_TO_MESSAGES = 'reply_to_messages',
  
  /** View patient documents (PHI) */
  VIEW_PATIENT_DOCUMENTS = 'view_patient_documents',
  
  /** Access clinical decision support tools */
  ACCESS_CLINICAL_TOOLS = 'access_clinical_tools',
  
  /** View own physician profile */
  VIEW_PHYSICIAN_PROFILE = 'view_physician_profile',
  
  /** Update own physician availability */
  UPDATE_AVAILABILITY = 'update_availability',

  // ============================================
  // ADMINISTRATIVE PERMISSIONS
  // ============================================
  
  /** View all users in system (admin view) */
  MANAGE_USERS = 'manage_users',
  
  /** Create, update, deactivate user accounts */
  USER_CRUD = 'user_crud',
  
  /** Manage physician accounts and credentials */
  MANAGE_PHYSICIANS = 'manage_physicians',
  
  /** Verify physician licenses and NPIs */
  VERIFY_PHYSICIAN_CREDENTIALS = 'verify_physician_credentials',
  
  /** View audit logs (compliance) */
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  
  /** Export audit logs (compliance reporting) */
  EXPORT_AUDIT_LOGS = 'export_audit_logs',
  
  /** Manage system configuration */
  MANAGE_SYSTEM = 'manage_system',
  
  /** View system analytics and metrics */
  VIEW_ANALYTICS = 'view_analytics',
  
  /** Manage billing settings and plans */
  MANAGE_BILLING = 'manage_billing',
  
  /** Process refunds */
  PROCESS_REFUNDS = 'process_refunds',
  
  /** Access admin dashboard */
  ACCESS_ADMIN_PANEL = 'access_admin_panel',
  
  /** Send system-wide notifications */
  SEND_NOTIFICATIONS = 'send_notifications',
  
  /** Manage content (FAQ, help articles) */
  MANAGE_CONTENT = 'manage_content',
  
  /** Impersonate users for support (with audit trail) */
  IMPERSONATE_USER = 'impersonate_user',
}

/**
 * Patient permissions - Self-service only
 * Patients can only access their own data (HIPAA minimum necessary)
 */
const PATIENT_PERMISSIONS: Permission[] = [
  Permission.VIEW_OWN_PROFILE,
  Permission.EDIT_OWN_PROFILE,
  Permission.VIEW_OWN_INTAKE,
  Permission.CREATE_INTAKE,
  Permission.VIEW_OWN_PRESCRIPTIONS,
  Permission.REQUEST_REFILL,
  Permission.VIEW_OWN_MESSAGES,
  Permission.SEND_MESSAGE,
  Permission.VIEW_OWN_DOCUMENTS,
  Permission.UPLOAD_DOCUMENT,
  Permission.VIEW_OWN_BILLING,
  Permission.MANAGE_SUBSCRIPTION,
  Permission.DELETE_OWN_ACCOUNT,
];

/**
 * Physician permissions - Clinical access
 * Physicians can access patient data for care delivery
 */
const PHYSICIAN_PERMISSIONS: Permission[] = [
  // All patient permissions for their own profile
  Permission.VIEW_PHYSICIAN_PROFILE,
  Permission.UPDATE_AVAILABILITY,
  
  // Patient access permissions
  Permission.VIEW_ALL_PATIENTS,
  Permission.VIEW_PATIENT_DETAILS,
  Permission.VIEW_PATIENT_DOCUMENTS,
  
  // Intake management
  Permission.REVIEW_INTAKE,
  Permission.APPROVE_INTAKE,
  Permission.REJECT_INTAKE,
  Permission.REQUEST_INTAKE_INFO,
  
  // Prescription management
  Permission.CREATE_PRESCRIPTION,
  Permission.SEND_PRESCRIPTION,
  Permission.CANCEL_PRESCRIPTION,
  
  // Messaging
  Permission.VIEW_PHYSICIAN_MESSAGES,
  Permission.REPLY_TO_MESSAGES,
  
  // Clinical tools
  Permission.ACCESS_CLINICAL_TOOLS,
];

/**
 * Admin permissions - System-wide access
 * Admins have all permissions for platform management
 */
const ADMIN_PERMISSIONS: Permission[] = [
  // All permissions from all roles
  ...PATIENT_PERMISSIONS,
  ...PHYSICIAN_PERMISSIONS,
  
  // Administrative permissions
  Permission.MANAGE_USERS,
  Permission.USER_CRUD,
  Permission.MANAGE_PHYSICIANS,
  Permission.VERIFY_PHYSICIAN_CREDENTIALS,
  Permission.VIEW_AUDIT_LOGS,
  Permission.EXPORT_AUDIT_LOGS,
  Permission.MANAGE_SYSTEM,
  Permission.VIEW_ANALYTICS,
  Permission.MANAGE_BILLING,
  Permission.PROCESS_REFUNDS,
  Permission.ACCESS_ADMIN_PANEL,
  Permission.SEND_NOTIFICATIONS,
  Permission.MANAGE_CONTENT,
  Permission.IMPERSONATE_USER,
];

/**
 * Role to permissions mapping
 * Maps each role to its granted permissions
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.PATIENT]: PATIENT_PERMISSIONS,
  [Role.PHYSICIAN]: PHYSICIAN_PERMISSIONS,
  [Role.ADMIN]: ADMIN_PERMISSIONS,
};

/**
 * All permissions in the system
 * Useful for validation and UI rendering
 */
export const ALL_PERMISSIONS = Object.values(Permission);

/**
 * Check if a role has a specific permission
 * 
 * @param role - The user's role
 * @param permission - The permission to check
 * @returns boolean indicating if the role has the permission
 * 
 * @example
 * ```typescript
 * if (hasPermission(user.role, Permission.VIEW_PATIENT_DETAILS)) {
 *   // Allow access to patient details
 * }
 * ```
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if a role has ALL of the specified permissions
 * 
 * @param role - The user's role
 * @param permissions - Array of permissions to check
 * @returns boolean indicating if the role has ALL permissions
 * 
 * @example
 * ```typescript
 * // Check if user can fully manage prescriptions
 * if (hasAllPermissions(user.role, [
 *   Permission.CREATE_PRESCRIPTION,
 *   Permission.SEND_PRESCRIPTION
 * ])) {
 *   // User has full prescription management
 * }
 * ```
 */
export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  if (!permissions.length) return true;
  const rolePerms = ROLE_PERMISSIONS[role] ?? [];
  return permissions.every(perm => rolePerms.includes(perm));
}

/**
 * Check if a role has ANY of the specified permissions
 * 
 * @param role - The user's role
 * @param permissions - Array of permissions to check
 * @returns boolean indicating if the role has ANY of the permissions
 * 
 * @example
 * ```typescript
 * // Check if user can view any patient data
 * if (hasAnyPermission(user.role, [
 *   Permission.VIEW_PATIENT_DETAILS,
 *   Permission.VIEW_ALL_PATIENTS
 * ])) {
 *   // Allow access to patient list
 * }
 * ```
 */
export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  if (!permissions.length) return true;
  const rolePerms = ROLE_PERMISSIONS[role] ?? [];
  return permissions.some(perm => rolePerms.includes(perm));
}

/**
 * Get all permissions for a role
 * 
 * @param role - The role to get permissions for
 * @returns Array of permissions for the role
 * 
 * @example
 * ```typescript
 * const patientPerms = getRolePermissions(Role.PATIENT);
 * // Returns all patient permissions
 * ```
 */
export function getRolePermissions(role: Role): Permission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}

/**
 * Check if a role has permission to access patient data
 * Used for HIPAA compliance - ensures minimum necessary access
 * 
 * @param role - The user's role
 * @returns boolean indicating if role can access patient data
 */
export function canAccessPatientData(role: Role): boolean {
  return role === Role.PHYSICIAN || role === Role.ADMIN;
}

/**
 * Check if user can access specific patient's data
 * 
 * HIPAA Compliance Rules:
 * - Physicians can access all patients for care delivery
 * - Patients can only access their own data
 * - Admins can access all data for platform management
 * 
 * @param accessorRole - The role of the user trying to access data
 * @param accessorUserId - The user ID of the accessor
 * @param targetPatientId - The patient ID being accessed
 * @returns boolean indicating if access is permitted
 * 
 * @example
 * ```typescript
 * // In API route
 * if (!canAccessPatient(user.role, user.userId, patientId)) {
 *   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 * }
 * ```
 */
export function canAccessPatient(
  accessorRole: Role,
  accessorUserId: string,
  targetPatientId: string
): boolean {
  // Admins and physicians can access all patients
  if (accessorRole === Role.ADMIN || accessorRole === Role.PHYSICIAN) {
    return true;
  }
  
  // Patients can only access their own data
  if (accessorRole === Role.PATIENT) {
    return accessorUserId === targetPatientId;
  }
  
  return false;
}

/**
 * Check if user can access specific physician's data
 * 
 * @param accessorRole - The role of the user trying to access data
 * @param accessorUserId - The user ID of the accessor
 * @param targetPhysicianId - The physician ID being accessed
 * @returns boolean indicating if access is permitted
 */
export function canAccessPhysician(
  accessorRole: Role,
  accessorUserId: string,
  targetPhysicianId: string
): boolean {
  // Admins can access all physicians
  if (accessorRole === Role.ADMIN) {
    return true;
  }
  
  // Physicians can access their own data
  if (accessorRole === Role.PHYSICIAN) {
    return accessorUserId === targetPhysicianId;
  }
  
  // Patients cannot access physician data directly
  return false;
}

/**
 * Check if user can send message to specific recipient
 * 
 * @param senderRole - The role of the sender
 * @param senderId - The user ID of the sender
 * @param recipientId - The user ID of the recipient
 * @param recipientRole - The role of the recipient
 * @returns boolean indicating if messaging is permitted
 */
export function canSendMessage(
  senderRole: Role,
  senderId: string,
  recipientId: string,
  recipientRole: Role
): boolean {
  // Patients can only message their assigned physicians
  if (senderRole === Role.PATIENT) {
    return recipientRole === Role.PHYSICIAN;
  }
  
  // Physicians can message their assigned patients
  if (senderRole === Role.PHYSICIAN) {
    return recipientRole === Role.PATIENT;
  }
  
  // Admins can message anyone
  if (senderRole === Role.ADMIN) {
    return true;
  }
  
  return false;
}

/**
 * Get the permission description for UI display
 * 
 * @param permission - The permission to get description for
 * @returns Human-readable description of the permission
 */
export function getPermissionDescription(permission: Permission): string {
  const descriptions: Record<Permission, string> = {
    [Permission.VIEW_OWN_PROFILE]: 'View own profile information',
    [Permission.EDIT_OWN_PROFILE]: 'Edit own profile information',
    [Permission.VIEW_OWN_INTAKE]: 'View own intake forms',
    [Permission.CREATE_INTAKE]: 'Create new intake forms',
    [Permission.VIEW_OWN_PRESCRIPTIONS]: 'View own prescriptions',
    [Permission.REQUEST_REFILL]: 'Request prescription refills',
    [Permission.VIEW_OWN_MESSAGES]: 'View own messages',
    [Permission.SEND_MESSAGE]: 'Send messages to physicians',
    [Permission.VIEW_OWN_DOCUMENTS]: 'View own uploaded documents',
    [Permission.UPLOAD_DOCUMENT]: 'Upload new documents',
    [Permission.VIEW_OWN_BILLING]: 'View billing information',
    [Permission.MANAGE_SUBSCRIPTION]: 'Manage subscription settings',
    [Permission.DELETE_OWN_ACCOUNT]: 'Delete own account',
    [Permission.VIEW_ALL_PATIENTS]: 'View all patients list',
    [Permission.VIEW_PATIENT_DETAILS]: 'View detailed patient information',
    [Permission.REVIEW_INTAKE]: 'Review patient intake forms',
    [Permission.APPROVE_INTAKE]: 'Approve intake and prescribe',
    [Permission.REJECT_INTAKE]: 'Reject intake with reason',
    [Permission.REQUEST_INTAKE_INFO]: 'Request additional information',
    [Permission.CREATE_PRESCRIPTION]: 'Create prescriptions',
    [Permission.SEND_PRESCRIPTION]: 'Send prescriptions to pharmacy',
    [Permission.CANCEL_PRESCRIPTION]: 'Cancel prescriptions',
    [Permission.VIEW_PHYSICIAN_MESSAGES]: 'View patient messages',
    [Permission.REPLY_TO_MESSAGES]: 'Reply to patient messages',
    [Permission.VIEW_PATIENT_DOCUMENTS]: 'View patient documents',
    [Permission.ACCESS_CLINICAL_TOOLS]: 'Access clinical decision support',
    [Permission.VIEW_PHYSICIAN_PROFILE]: 'View own physician profile',
    [Permission.UPDATE_AVAILABILITY]: 'Update availability schedule',
    [Permission.MANAGE_USERS]: 'Manage user accounts',
    [Permission.USER_CRUD]: 'Create, update, delete users',
    [Permission.MANAGE_PHYSICIANS]: 'Manage physician accounts',
    [Permission.VERIFY_PHYSICIAN_CREDENTIALS]: 'Verify physician credentials',
    [Permission.VIEW_AUDIT_LOGS]: 'View audit logs',
    [Permission.EXPORT_AUDIT_LOGS]: 'Export audit logs',
    [Permission.MANAGE_SYSTEM]: 'Manage system settings',
    [Permission.VIEW_ANALYTICS]: 'View platform analytics',
    [Permission.MANAGE_BILLING]: 'Manage billing settings',
    [Permission.PROCESS_REFUNDS]: 'Process refunds',
    [Permission.ACCESS_ADMIN_PANEL]: 'Access admin dashboard',
    [Permission.SEND_NOTIFICATIONS]: 'Send system notifications',
    [Permission.MANAGE_CONTENT]: 'Manage content and FAQs',
    [Permission.IMPERSONATE_USER]: 'Impersonate users for support',
  };
  
  return descriptions[permission] || permission;
}

/**
 * Get role display name for UI
 * 
 * @param role - The role to get display name for
 * @returns Human-readable role name
 */
export function getRoleDisplayName(role: Role): string {
  const displayNames: Record<Role, string> = {
    [Role.PATIENT]: 'Patient',
    [Role.PHYSICIAN]: 'Physician',
    [Role.ADMIN]: 'Administrator',
  };
  
  return displayNames[role] || role;
}

/**
 * Get role description for UI
 * 
 * @param role - The role to get description for
 * @returns Human-readable role description
 */
export function getRoleDescription(role: Role): string {
  const descriptions: Record<Role, string> = {
    [Role.PATIENT]: 'Standard user receiving telehealth services',
    [Role.PHYSICIAN]: 'Licensed medical provider with patient access',
    [Role.ADMIN]: 'Platform administrator with full system access',
  };
  
  return descriptions[role] || '';
}
