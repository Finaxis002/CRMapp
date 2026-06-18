import React from 'react';

import ActivityTypeTab from './ActivityTypeTab.jsx';

const TasksTab = ({ leadId, users, theme, activityRefreshTrigger }) => (
  <ActivityTypeTab
    leadId={leadId}
    type="Task"
    users={users}
    theme={theme}
    activityRefreshTrigger={activityRefreshTrigger}
  />
);

export default TasksTab;
