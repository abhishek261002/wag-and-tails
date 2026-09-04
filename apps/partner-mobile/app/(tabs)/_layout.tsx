import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { colors } from '@wag/design-tokens';

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 4 }}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text style={{ fontSize: 10, fontFamily: 'Inter', fontWeight: focused ? '700' : '500', color: focused ? colors.brandBrown : colors.textMuted, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

export default function PartnerTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.borderLight,
          height: 68,
          paddingBottom: 8,
        },
      }}
    >
      <Tabs.Screen name="jobs" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="💼" label="Jobs" focused={focused} /> }} />
      <Tabs.Screen name="schedule" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📅" label="Schedule" focused={focused} /> }} />
      <Tabs.Screen name="store" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" label="Store" focused={focused} /> }} />
      <Tabs.Screen name="earnings" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="💰" label="Earnings" focused={focused} /> }} />
      <Tabs.Screen name="account" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Account" focused={focused} /> }} />
    </Tabs>
  );
}
