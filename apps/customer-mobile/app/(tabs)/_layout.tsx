import { Tabs } from 'expo-router';
import { TabBarIcon, tabBarStyle } from '@wag/ui-mobile';

// Icons and ordering follow the prototype's C_TABS. Its Pets tab is not
// here yet — pets are currently only reachable via /pet/[id], so the tab
// arrives with that screen rather than pointing at a route that does not
// exist.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle,
      }}
    >
      <Tabs.Screen name="home" options={{ tabBarIcon: ({ focused }) => <TabBarIcon name="home" label="Home" focused={focused} /> }} />
      <Tabs.Screen name="store" options={{ tabBarIcon: ({ focused }) => <TabBarIcon name="bag" label="Store" focused={focused} /> }} />
      <Tabs.Screen name="bookings" options={{ tabBarIcon: ({ focused }) => <TabBarIcon name="cal" label="Bookings" focused={focused} /> }} />
      <Tabs.Screen name="account" options={{ tabBarIcon: ({ focused }) => <TabBarIcon name="user" label="Account" focused={focused} /> }} />
    </Tabs>
  );
}
