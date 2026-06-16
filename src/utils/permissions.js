export const PERMISSION_LABELS = {
  view_all_leads: 'View all leads',
  view_team_leads_only: 'View team leads only',
  add_leads: 'Add leads',
  edit_any_lead: 'Edit any lead',
  delete_leads: 'Delete leads',
  assign_leads: 'Assign leads',
  change_lead_owner: 'Change lead owner',
  record_payments: 'Record payments',
  import_leads: 'Import from sheets',
  view_team: 'View team',
  manage_users: 'Manage users',
  admin_panel: 'Admin panel',
};

export const DEFAULT_ROLE_PERMISSIONS = {
  admin: [
    'add_leads',
    'edit_any_lead',
    'delete_leads',
    'assign_leads',
    'record_payments',
    'view_all_leads',
    'manage_users',
    'admin_panel',
  ],
  manager: [],
  tl: [],
  exec: [],
  viewer: [],
};

const resolvePermissionLabel = permissionName =>
  PERMISSION_LABELS[permissionName] || permissionName;

export const canUser = (user, settings, permissionName) => {
  if (!user) return false;

  // 1. Admin always has access
  if (user.role === 'admin') return true;

  const label = resolvePermissionLabel(permissionName);

  // 2. Database Check (Priority)
  const configuredValue = settings?.permissions?.[label]?.[user.role];
  if (configuredValue !== undefined) {
    return Boolean(configuredValue);
  }

  // 3. Fallback to Hardcoded Defaults
  const defaults = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
  return defaults.includes(permissionName);
};

export const getPermissionLabel = permissionName =>
  PERMISSION_LABELS[permissionName] || permissionName;
