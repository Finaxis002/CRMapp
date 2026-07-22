import React, { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Topbar from '../components/layout/Topbar';
import CustomSidebar from '../components/layout/CustomSidebar';
import { SidebarProvider } from '../contexts/SidebarContext';
import { ThemeProvider } from '../contexts/ThemeContext';

// Screens
import DashboardScreen from '../screens/main/DashboardScreen';
import LeadsScreen from '../screens/main/LeadsScreen';
import PipelineScreen from '../screens/main/PipelineScreen';
import CalendarScreen from '../screens/main/CalendarScreen';
import PaymentsScreen from '../screens/main/PaymentsScreen';
import AttendanceScreen from '../screens/main/AttendanceScreen';
import ImportScreen from '../screens/main/ImportScreen';
import CrossSellDashboardScreen from '../screens/main/CrossSellDashboardScreen';
import CallTracingScreen from '../screens/main/CallTracingScreen';
import TeamScreen from '../screens/main/TeamScreen';
import AdminPanelScreen from '../screens/main/AdminPanelScreen';
import IntegrationScreen from '../screens/main/IntegrationScreen';
import ReportsScreen from '../screens/main/ReportsScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import AddScheduleScreen from '../components/ui/AddScheduleScreen';
import AddPaymentScreen from '../components/ui/AddPaymentScreen';
const Stack = createNativeStackNavigator();

const MainNavigator = () => {
  // Track current route name so CustomSidebar (rendered OUTSIDE the navigator)
  // can highlight the active item
  const [currentRoute, setCurrentRoute] = useState('Dashboard');

  return (
    <ThemeProvider>
      <SidebarProvider>
        {/* Custom sidebar rendered ONCE above everything */}
        <CustomSidebar currentRoute={currentRoute} />

        <Stack.Navigator
          screenOptions={{
            header: props => <Topbar {...props} />,
          }}
          screenListeners={{
            state: e => {
              const state = e?.data?.state;
              if (!state || !state.routes || state.index == null) return;
              const route = state.routes[state.index];
              if (route?.name && route.name !== currentRoute) {
                setCurrentRoute(route.name);
              }
            },
          }}
        >
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Leads" component={LeadsScreen} />
          <Stack.Screen name="Pipeline" component={PipelineScreen} />
          <Stack.Screen name="Calendar" component={CalendarScreen} />
          <Stack.Screen name="Payments" component={PaymentsScreen} />
          <Stack.Screen
            name="AddPayment"
            component={AddPaymentScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="Attendance" component={AttendanceScreen} />
          <Stack.Screen name="Import" component={ImportScreen} />
          <Stack.Screen name="CrossSell" component={CrossSellDashboardScreen} />
          <Stack.Screen name="CallTracing" component={CallTracingScreen} />
          <Stack.Screen
            name="AddSchedule"
            component={AddScheduleScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          {/* Admin section */}
          <Stack.Screen name="Team" component={TeamScreen} />
          <Stack.Screen name="AdminPanel" component={AdminPanelScreen} />
          <Stack.Screen name="Integrations" component={IntegrationScreen} />
          <Stack.Screen name="Reports" component={ReportsScreen} />

          {/* Accessed from header icons (not from sidebar) */}
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </SidebarProvider>
    </ThemeProvider>
  );
};

export default MainNavigator;
