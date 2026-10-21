import { Tabs } from "expo-router/js-tabs";
import { TabBar } from "@/components/TabBar";
import { colors } from "@/theme/tokens";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...(props as unknown as Parameters<typeof TabBar>[0])} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="loans" />
      <Tabs.Screen name="people" />
      <Tabs.Screen name="insights" />
    </Tabs>
  );
}
