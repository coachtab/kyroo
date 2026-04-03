import { Tabs } from 'expo-router';
import { colors, font } from '../../src/lib/theme';
import { Text } from 'react-native';

function TabIcon({ label, active }: { label: string; active: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: active ? 1 : 0.45 }}>{label}</Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0D0D0B',
          borderTopColor: '#1C1C18',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontFamily: font.mono,
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        },
        tabBarActiveTintColor: '#3D9E6A',
        tabBarInactiveTintColor: '#444',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Programs',
          tabBarIcon: ({ focused }) => <TabIcon label="⚡" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="calculator"
        options={{
          title: 'Calculator',
          tabBarIcon: ({ focused }) => <TabIcon label="🧮" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          tabBarIcon: ({ focused }) => <TabIcon label="⚡" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon label="👤" active={focused} />,
        }}
      />
    </Tabs>
  );
}
