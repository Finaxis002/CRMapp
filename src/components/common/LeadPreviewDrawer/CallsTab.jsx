import React from 'react';
import { View } from 'react-native';

import ActivityTypeTab from './ActivityTypeTab';

const CallsTab = ({
  leadId,
  users,
  theme,
  activityRefreshTrigger,
  onActivitySaved,
}) => {
  return (
    <View style={{ flex: 1 }}>
      <ActivityTypeTab
        leadId={leadId}
        type="Call"
        users={users}
        theme={theme}
        activityRefreshTrigger={activityRefreshTrigger}
        onActivitySaved={onActivitySaved}
        hideEmptyState={true}
      />
    </View>
  );
};

export default CallsTab;
