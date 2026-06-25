import React from 'react';
import ActivityTypeTab from './ActivityTypeTab';

const CallLogsTab = ({ leadId, users, theme, activityRefreshTrigger }) => {
  return (
    <ActivityTypeTab
      leadId={leadId}
      type="Call"
      users={users}
      theme={theme}
      activityRefreshTrigger={activityRefreshTrigger}
      hideEmptyState
    />
  );
};

export default CallLogsTab;
