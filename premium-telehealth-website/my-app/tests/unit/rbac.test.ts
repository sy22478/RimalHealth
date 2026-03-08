/**
 * Role-Based Access Control (RBAC) Unit Tests
 * Tests permission checking functions
 * 
 * @module tests/unit/rbac
 */

import { describe, it, expect } from 'vitest';
import { Role } from '@prisma/client';
import {
  Permission,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getRolePermissions,
  canAccessPatientData,
  canAccessPatient,
  canAccessPhysician,
  canSendMessage,
  getPermissionDescription,
  getRoleDisplayName,
  getRoleDescription,
  ROLE_PERMISSIONS,
} from '@/lib/auth/rbac';

describe('RBAC', () => {
  describe('Permission enum', () => {
    it('should contain patient permissions', () => {
      expect(Permission.VIEW_OWN_PROFILE).toBe('view_own_profile');
      expect(Permission.EDIT_OWN_PROFILE).toBe('edit_own_profile');
      expect(Permission.VIEW_OWN_PRESCRIPTIONS).toBe('view_own_prescriptions');
      expect(Permission.SEND_MESSAGE).toBe('send_message');
    });

    it('should contain physician permissions', () => {
      expect(Permission.VIEW_PATIENT_DETAILS).toBe('view_patient_details');
      expect(Permission.REVIEW_INTAKE).toBe('review_intake');
      expect(Permission.CREATE_PRESCRIPTION).toBe('create_prescription');
      expect(Permission.REPLY_TO_MESSAGES).toBe('reply_to_messages');
    });

    it('should contain admin permissions', () => {
      expect(Permission.MANAGE_USERS).toBe('manage_users');
      expect(Permission.VIEW_AUDIT_LOGS).toBe('view_audit_logs');
      expect(Permission.ACCESS_ADMIN_PANEL).toBe('access_admin_panel');
      expect(Permission.IMPERSONATE_USER).toBe('impersonate_user');
    });
  });

  describe('hasPermission', () => {
    it('should grant admin all permissions', () => {
      const allPermissions = Object.values(Permission);
      
      for (const permission of allPermissions) {
        expect(hasPermission(Role.ADMIN, permission)).toBe(true);
      }
    });

    it('should grant physician clinical permissions', () => {
      expect(hasPermission(Role.PHYSICIAN, Permission.VIEW_PATIENT_DETAILS)).toBe(true);
      expect(hasPermission(Role.PHYSICIAN, Permission.REVIEW_INTAKE)).toBe(true);
      expect(hasPermission(Role.PHYSICIAN, Permission.CREATE_PRESCRIPTION)).toBe(true);
      expect(hasPermission(Role.PHYSICIAN, Permission.REPLY_TO_MESSAGES)).toBe(true);
    });

    it('should restrict physician from admin permissions', () => {
      expect(hasPermission(Role.PHYSICIAN, Permission.MANAGE_USERS)).toBe(false);
      expect(hasPermission(Role.PHYSICIAN, Permission.VIEW_AUDIT_LOGS)).toBe(false);
      expect(hasPermission(Role.PHYSICIAN, Permission.ACCESS_ADMIN_PANEL)).toBe(false);
    });

    it('should grant patient self-service permissions', () => {
      expect(hasPermission(Role.PATIENT, Permission.VIEW_OWN_PROFILE)).toBe(true);
      expect(hasPermission(Role.PATIENT, Permission.VIEW_OWN_PRESCRIPTIONS)).toBe(true);
      expect(hasPermission(Role.PATIENT, Permission.SEND_MESSAGE)).toBe(true);
      expect(hasPermission(Role.PATIENT, Permission.MANAGE_SUBSCRIPTION)).toBe(true);
    });

    it('should restrict patient from viewing other patient data', () => {
      expect(hasPermission(Role.PATIENT, Permission.VIEW_PATIENT_DETAILS)).toBe(false);
      expect(hasPermission(Role.PATIENT, Permission.VIEW_ALL_PATIENTS)).toBe(false);
      expect(hasPermission(Role.PATIENT, Permission.REVIEW_INTAKE)).toBe(false);
    });

    it('should restrict patient from PHI access', () => {
      expect(hasPermission(Role.PATIENT, Permission.VIEW_PATIENT_DOCUMENTS)).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true when all permissions are granted', () => {
      const permissions = [
        Permission.VIEW_PATIENT_DETAILS,
        Permission.REVIEW_INTAKE,
      ];
      expect(hasAllPermissions(Role.PHYSICIAN, permissions)).toBe(true);
    });

    it('should return false when any permission is missing', () => {
      const permissions = [
        Permission.VIEW_PATIENT_DETAILS,
        Permission.MANAGE_USERS, // Admin only
      ];
      expect(hasAllPermissions(Role.PHYSICIAN, permissions)).toBe(false);
    });

    it('should return true for empty array', () => {
      expect(hasAllPermissions(Role.PATIENT, [])).toBe(true);
    });

    it('should work for admin with mix of permissions', () => {
      const permissions = [
        Permission.VIEW_PATIENT_DETAILS,
        Permission.MANAGE_USERS,
        Permission.ACCESS_ADMIN_PANEL,
      ];
      expect(hasAllPermissions(Role.ADMIN, permissions)).toBe(true);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true when any permission is granted', () => {
      const permissions = [
        Permission.MANAGE_USERS, // Admin only
        Permission.VIEW_PATIENT_DETAILS, // Physician has this
      ];
      expect(hasAnyPermission(Role.PHYSICIAN, permissions)).toBe(true);
    });

    it('should return false when no permissions are granted', () => {
      const permissions = [
        Permission.MANAGE_USERS,
        Permission.ACCESS_ADMIN_PANEL,
      ];
      expect(hasAnyPermission(Role.PHYSICIAN, permissions)).toBe(false);
    });

    it('should return true for empty array', () => {
      expect(hasAnyPermission(Role.PATIENT, [])).toBe(true);
    });

    it('should work for patient with own data permissions', () => {
      const permissions = [
        Permission.VIEW_OWN_PROFILE,
        Permission.VIEW_PATIENT_DETAILS, // Patient doesn't have this
      ];
      expect(hasAnyPermission(Role.PATIENT, permissions)).toBe(true);
    });
  });

  describe('getRolePermissions', () => {
    it('should return all permissions for admin', () => {
      const perms = getRolePermissions(Role.ADMIN);
      expect(perms.length).toBeGreaterThan(20);
      expect(perms).toContain(Permission.MANAGE_USERS);
      expect(perms).toContain(Permission.ACCESS_ADMIN_PANEL);
    });

    it('should return physician permissions', () => {
      const perms = getRolePermissions(Role.PHYSICIAN);
      expect(perms).toContain(Permission.VIEW_PATIENT_DETAILS);
      expect(perms).toContain(Permission.CREATE_PRESCRIPTION);
      expect(perms).not.toContain(Permission.MANAGE_USERS);
    });

    it('should return patient permissions', () => {
      const perms = getRolePermissions(Role.PATIENT);
      expect(perms).toContain(Permission.VIEW_OWN_PROFILE);
      expect(perms).toContain(Permission.SEND_MESSAGE);
      expect(perms).not.toContain(Permission.VIEW_PATIENT_DETAILS);
    });

    it('should return copy of permissions array', () => {
      const perms1 = getRolePermissions(Role.PATIENT);
      const perms2 = getRolePermissions(Role.PATIENT);
      expect(perms1).toEqual(perms2);
      expect(perms1).not.toBe(perms2); // Different array instances
    });
  });

  describe('canAccessPatientData', () => {
    it('should allow physician to access patient data', () => {
      expect(canAccessPatientData(Role.PHYSICIAN)).toBe(true);
    });

    it('should allow admin to access patient data', () => {
      expect(canAccessPatientData(Role.ADMIN)).toBe(true);
    });

    it('should deny patient from accessing other patient data', () => {
      expect(canAccessPatientData(Role.PATIENT)).toBe(false);
    });
  });

  describe('canAccessPatient', () => {
    const accessorUserId = 'user_123';
    const targetPatientId = 'patient_456';

    it('should allow admin to access any patient', () => {
      expect(canAccessPatient(Role.ADMIN, accessorUserId, targetPatientId)).toBe(true);
    });

    it('should allow physician to access any patient', () => {
      expect(canAccessPatient(Role.PHYSICIAN, accessorUserId, targetPatientId)).toBe(true);
    });

    it('should allow patient to access own data', () => {
      expect(canAccessPatient(Role.PATIENT, accessorUserId, accessorUserId)).toBe(true);
    });

    it('should deny patient from accessing other patient data', () => {
      expect(canAccessPatient(Role.PATIENT, accessorUserId, targetPatientId)).toBe(false);
    });
  });

  describe('canAccessPhysician', () => {
    const accessorUserId = 'user_123';
    const targetPhysicianId = 'physician_456';

    it('should allow admin to access any physician', () => {
      expect(canAccessPhysician(Role.ADMIN, accessorUserId, targetPhysicianId)).toBe(true);
    });

    it('should allow physician to access own data', () => {
      expect(canAccessPhysician(Role.PHYSICIAN, accessorUserId, accessorUserId)).toBe(true);
    });

    it('should deny physician from accessing other physician data', () => {
      expect(canAccessPhysician(Role.PHYSICIAN, accessorUserId, targetPhysicianId)).toBe(false);
    });

    it('should deny patient from accessing physician data', () => {
      expect(canAccessPhysician(Role.PATIENT, accessorUserId, targetPhysicianId)).toBe(false);
    });
  });

  describe('canSendMessage', () => {
    const senderId = 'user_123';
    const recipientId = 'user_456';

    it('should allow patient to message physician', () => {
      expect(canSendMessage(Role.PATIENT, senderId, recipientId, Role.PHYSICIAN)).toBe(true);
    });

    it('should deny patient from messaging another patient', () => {
      expect(canSendMessage(Role.PATIENT, senderId, recipientId, Role.PATIENT)).toBe(false);
    });

    it('should allow physician to message patient', () => {
      expect(canSendMessage(Role.PHYSICIAN, senderId, recipientId, Role.PATIENT)).toBe(true);
    });

    it('should deny physician from messaging another physician', () => {
      expect(canSendMessage(Role.PHYSICIAN, senderId, recipientId, Role.PHYSICIAN)).toBe(false);
    });

    it('should allow admin to message anyone', () => {
      expect(canSendMessage(Role.ADMIN, senderId, recipientId, Role.PATIENT)).toBe(true);
      expect(canSendMessage(Role.ADMIN, senderId, recipientId, Role.PHYSICIAN)).toBe(true);
      expect(canSendMessage(Role.ADMIN, senderId, recipientId, Role.ADMIN)).toBe(true);
    });
  });

  describe('getPermissionDescription', () => {
    it('should return description for patient permission', () => {
      const desc = getPermissionDescription(Permission.VIEW_OWN_PROFILE);
      expect(desc).toContain('profile');
      expect(typeof desc).toBe('string');
    });

    it('should return description for physician permission', () => {
      const desc = getPermissionDescription(Permission.REVIEW_INTAKE);
      expect(desc).toContain('intake');
      expect(typeof desc).toBe('string');
    });

    it('should return description for admin permission', () => {
      const desc = getPermissionDescription(Permission.MANAGE_USERS);
      expect(desc).toContain('user');
      expect(typeof desc).toBe('string');
    });

    it('should return permission value for unknown permission', () => {
      const desc = getPermissionDescription('unknown_permission' as Permission);
      expect(desc).toBe('unknown_permission');
    });
  });

  describe('getRoleDisplayName', () => {
    it('should return display name for patient', () => {
      expect(getRoleDisplayName(Role.PATIENT)).toBe('Patient');
    });

    it('should return display name for physician', () => {
      expect(getRoleDisplayName(Role.PHYSICIAN)).toBe('Physician');
    });

    it('should return display name for admin', () => {
      expect(getRoleDisplayName(Role.ADMIN)).toBe('Administrator');
    });
  });

  describe('getRoleDescription', () => {
    it('should return description for patient', () => {
      const desc = getRoleDescription(Role.PATIENT);
      expect(desc).toContain('telehealth');
      expect(typeof desc).toBe('string');
    });

    it('should return description for physician', () => {
      const desc = getRoleDescription(Role.PHYSICIAN);
      expect(desc).toContain('medical');
      expect(typeof desc).toBe('string');
    });

    it('should return description for admin', () => {
      const desc = getRoleDescription(Role.ADMIN);
      expect(desc).toContain('administrator');
      expect(typeof desc).toBe('string');
    });
  });

  describe('ROLE_PERMISSIONS', () => {
    it('should have entries for all roles', () => {
      expect(ROLE_PERMISSIONS[Role.PATIENT]).toBeDefined();
      expect(ROLE_PERMISSIONS[Role.PHYSICIAN]).toBeDefined();
      expect(ROLE_PERMISSIONS[Role.ADMIN]).toBeDefined();
    });

    it('should have more permissions for admin than physician', () => {
      const adminPerms = ROLE_PERMISSIONS[Role.ADMIN].length;
      const physicianPerms = ROLE_PERMISSIONS[Role.PHYSICIAN].length;
      expect(adminPerms).toBeGreaterThan(physicianPerms);
    });

    it('should have more permissions for physician than patient', () => {
      const physicianPerms = ROLE_PERMISSIONS[Role.PHYSICIAN].length;
      const patientPerms = ROLE_PERMISSIONS[Role.PATIENT].length;
      expect(physicianPerms).toBeGreaterThan(patientPerms);
    });
  });
});
