import React from 'react';

import ActivityTypeTab from './ActivityTypeTab.jsx';

const CallsTab = ({ leadId, users, theme, activityRefreshTrigger }) => (
  <ActivityTypeTab
    leadId={leadId}
    type="Call"
    users={users}
    theme={theme}
    activityRefreshTrigger={activityRefreshTrigger}
  />
);

export default CallsTab;
