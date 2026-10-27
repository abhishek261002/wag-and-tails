import { Tabs } from 'expo-router';
import { TabBarIcon, useTabBarStyle } from '@wag/ui-mobile';

// Icons and ordering follow the prototype's C_TABS: Home, Store, Bookings, Pets, Account.
export default function TabsLayout() {
  const tabBarStyle = useTabBarStyle();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle,
        // With the keyboard open the bar is hidden, so it can't float above the keyboard or leave a gap behind it.
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="home" options={{ tabBarIcon: ({ focused }) => <TabBarIcon name="home" label="Home" focused={focused} /> }} />
      <Tabs.Screen name="store" options={{ tabBarIcon: ({ focused }) => <TabBarIcon name="bag" label="Store" focused={focused} /> }} />
      <Tabs.Screen name="bookings" options={{ tabBarIcon: ({ focused }) => <TabBarIcon name="cal" label="Bookings" focused={focused} /> }} />
      <Tabs.Screen name="pets" options={{ tabBarIcon: ({ focused }) => <TabBarIcon name="paw" label="Pets" focused={focused} /> }} />
      <Tabs.Screen name="account" options={{ tabBarIcon: ({ focused }) => <TabBarIcon name="user" label="Account" focused={focused} /> }} />
    </Tabs>
  );
}
