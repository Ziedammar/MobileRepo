import { Stack } from 'expo-router';

export default function PublicLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="landing" />
      <Stack.Screen name="signin" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
