import { Stack } from 'expo-router';
import { Colors } from '../../constants/Colors';

export default function RequestsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: Colors.primary,
        headerStyle: { backgroundColor: Colors.background },
        headerTitleStyle: { fontWeight: 'bold' },
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'My Requests',
        }} 
      />
      <Stack.Screen 
        name="new" 
        options={{ 
          title: 'New Request',
          presentation: 'modal'
        }} 
      />
    </Stack>
  );
}
