import React from 'react';
import { Dimensions } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';

import CustomDrawerContent from '../components/layout/CustomDrawerContent';
import Topbar from '../components/layout/Topbar';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH * 0.8;

// Screens
import DashboardScreen from '../screens/main/DashboardScreen';
import LeadsScreen from '../screens/main/LeadsScreen';
import PipelineScreen from '../screens/main/PipelineScreen';
import CalendarScreen from '../screens/main/CalendarScreen';
import PaymentsScreen from '../screens/main/PaymentsScreen';
import AttendanceScreen from '../screens/main/AttendanceScreen';
import ImportScreen from '../screens/main/ImportScreen';
import CrossSellDashboardScreen from '../screens/main/CrossSellDashboardScreen';
import TeamScreen from '../screens/main/TeamScreen';
import AdminPanelScreen from '../screens/main/AdminPanelScreen';
import IntegrationScreen from '../screens/main/IntegrationScreen';
import ReportsScreen from '../screens/main/ReportsScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import SettingsScreen from '../screens/main/SettingsScreen';

const Drawer = createDrawerNavigator();

const MainNavigator = () => {
  return (
    <Drawer.Navigator
      drawerContent={props => <CustomDrawerContent {...props} />}
      screenOptions={{
        header: props => <Topbar {...props} />,
        drawerStyle: {
          width: DRAWER_WIDTH,
        },
        drawerType: 'slide',
        overlayColor: 'rgba(0, 0, 0, 0.5)',
        swipeEnabled: true,
        swipeEdgeWidth: 30,
      }}
    >
      <Drawer.Screen name="Dashboard" component={DashboardScreen} />
      <Drawer.Screen name="Leads" component={LeadsScreen} />
      <Drawer.Screen name="Pipeline" component={PipelineScreen} />
      <Drawer.Screen name="Calendar" component={CalendarScreen} />
      <Drawer.Screen
        name="Payments"
        component={PaymentsScreen}
        options={{ drawerLabel: 'Payments' }}
      />
      <Drawer.Screen name="Attendance" component={AttendanceScreen} />
      <Drawer.Screen name="Import" component={ImportScreen} />
      <Drawer.Screen name="CrossSell" component={CrossSellDashboardScreen} />

      {/* Admin section (filtered in CustomDrawerContent) */}
      <Drawer.Screen name="Team" component={TeamScreen} />
      <Drawer.Screen name="AdminPanel" component={AdminPanelScreen} />
      <Drawer.Screen name="Integrations" component={IntegrationScreen} />
      <Drawer.Screen name="Reports" component={ReportsScreen} />

      {/* Hidden from drawer (accessed via header icons) */}
      <Drawer.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ drawerItemStyle: { display: 'none' } }}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ drawerItemStyle: { display: 'none' } }}
      />
    </Drawer.Navigator>
  );
};

export default MainNavigator;
