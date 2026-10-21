import { WifiOff } from "lucide-react-native";
import { EmptyState } from "./EmptyState";

export interface ErrorStateProps { title?: string; body?: string; onRetry: () => void }

export function ErrorState({ title = "Couldn't reach MiniLedger", body = "Check that the server is running and your phone is on the same network.", onRetry }: ErrorStateProps) {
  return <EmptyState icon={WifiOff} tone="muted" title={title} body={body} action={{ title: "Try again", onPress: onRetry, variant: "secondary" }} />;
}
