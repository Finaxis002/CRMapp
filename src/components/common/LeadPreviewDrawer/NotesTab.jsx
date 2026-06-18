import React from 'react';
import ActivityTypeTab from './ActivityTypeTab.jsx';

const NotesTab = ({ leadId, users, theme, activityRefreshTrigger }) => (
  <ActivityTypeTab
    leadId={leadId}
    type="Note"
    users={users}
    theme={theme}
    activityRefreshTrigger={activityRefreshTrigger}
  />
);

export default NotesTab;
