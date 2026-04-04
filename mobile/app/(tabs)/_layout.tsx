import { Tabs } from 'expo-router';
import { font } from '../../src/lib/theme';
import { Text } from 'react-native';

function TabIcon({ label, active }: { label: string; active: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: active ? 1 : 0.4 }}>{label}</Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#07070F',
          borderTopColor: '#18183A',
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
        tabBarActiveTintColor: '#5B5EF4',
        tabBarInactiveTintColor: '#40405A',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ focused }) => <TabIcon label="⚡" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="calculator"
        options={{
          title: 'Tools',
          tabBarIcon: ({ focused }) => <TabIcon label="🛠️" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Progress',
          tabBarIcon: ({ focused }) => <TabIcon label="📈" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Me',
          tabBarIcon: ({ focused }) => <TabIcon label="👤" active={focused} />,
        }}
      />
    </Tabs>
  );
}
