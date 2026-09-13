import { Tabs } from 'expo-router';
import { TabBarIcon, tabBarStyle } from '@wag/ui-mobile';

// Tabs, icons and order match the prototype's P_TABS exactly.
export default function PartnerTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle,
      }}
    >
      <Tabs.Screen name="jobs" options={{ tabBarIcon: ({ focused }) => <TabBarIcon name="brief" label="Jobs" focused={focused} /> }} />
      <Tabs.Screen name="schedule" options={{ tabBarIcon: ({ focused }) => <TabBarIcon name="cal" label="Schedule" focused={focused} /> }} />
      <Tabs.Screen name="store" options={{ tabBarIcon: ({ focused }) => <TabBarIcon name="bag" label="Store" focused={focused} /> }} />
      <Tabs.Screen name="earnings" options={{ tabBarIcon: ({ focused }) => <TabBarIcon name="wallet" label="Earnings" focused={focused} /> }} />
      <Tabs.Screen name="account" options={{ tabBarIcon: ({ focused }) => <TabBarIcon name="user" label="Account" focused={focused} /> }} />
    </Tabs>
  );
}
