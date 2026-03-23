import { Stack } from "expo-router";
import Colors from "@/constants/colors";

export default function GameLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bgDeep },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="lobby" />
      <Stack.Screen name="waiting-room" />
      <Stack.Screen name="match" />
      <Stack.Screen name="game-over" />
    </Stack>
  );
}
