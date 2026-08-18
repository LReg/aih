import { Role } from '../types/User';

/**
 * Zitadel's project-roles claim, present on both the access token and the OIDC
 * userinfo response once "Assert Roles on Authentication" is enabled on the
 * project — shape is { [roleKey]: { [orgId]: orgName } }.
 */
const PROJECT_ROLES_CLAIM = 'urn:zitadel:iam:org:project:roles';

export function extractZitadelRole(claims: Record<string, unknown>): Role {
  const roles = claims[PROJECT_ROLES_CLAIM] as Record<string, unknown> | undefined;
  return roles && 'admin' in roles ? Role.ADMIN : Role.USER;
}
