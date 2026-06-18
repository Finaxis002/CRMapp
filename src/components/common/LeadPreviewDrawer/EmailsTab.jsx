import React from 'react';

import ActivityTypeTab from './ActivityTypeTab.jsx';

const EmailsTab = ({ leadId, users, theme, activityRefreshTrigger }) => (
  <ActivityTypeTab
    leadId={leadId}
    type="Email"
    users={users}
    theme={theme}
    activityRefreshTrigger={activityRefreshTrigger}
  />
);

export default EmailsTab;
