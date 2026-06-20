import React from 'react';
import { View } from 'react-native';

import ActivityTypeTab from './ActivityTypeTab.jsx';
import CallLogsTab from '../../../services/callLogsTab.js';

const CallsTab = ({
  leadId,
  users,
  theme,
  activityRefreshTrigger,
  onActivitySaved,
}) => (
  <View style={{ flex: 1 }}>
    <ActivityTypeTab
      leadId={leadId}
      type="Call"
      users={users}
      theme={theme}
      activityRefreshTrigger={activityRefreshTrigger}
      onActivitySaved={onActivitySaved}
    />
    <CallLogsTab
      leadId={leadId}
      theme={theme}
      refreshTrigger={activityRefreshTrigger}
    />
  </View>
);

export default CallsTab;
