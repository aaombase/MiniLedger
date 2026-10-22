import { useState } from "react";
import { Camera, X } from "lucide-react-native";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { pickImage, type PickedImage, type PickSource } from "@/platform/imagePicker";
import { Banner } from "./Banner";
import { ConfirmSheet } from "./ConfirmSheet";

export interface PhotoFieldProps {
  label: string;
  hint: string;
  value: PickedImage | null;
  onChange: (image: PickedImage | null) => void;
}

/** An optional photo on a form: choose camera or gallery, see a preview, remove it before saving. */
export function PhotoField({ label, hint, value, onChange }: PhotoFieldProps) {
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(source: PickSource) {
    setSheet(false);
    setError(null);
    try {
      const img = await pickImage(source);
      if (img) onChange(img);
    } catch (e) {
      setError(
        e instanceof Error && e.name === "CameraPermissionError"
          ? "Camera access is off. Allow it for Expo Go in your phone's settings, or choose from your gallery."
          : "Couldn't load that photo. Try another.",
      );
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {value ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: value.uri }} style={styles.preview} resizeMode="cover" accessibilityLabel="Selected photo" />
          <Pressable onPress={() => onChange(null)} accessibilityLabel="Remove photo" style={styles.clear} hitSlop={8}>
            <X size={16} color={colors.onPrimary} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => setSheet(true)}
          accessibilityLabel={label}
          style={({ pressed }) => [styles.drop, pressed ? { backgroundColor: colors.surfaceMuted } : null]}
        >
          <Camera size={22} color={colors.inkMuted} />
          <Text style={styles.dropText}>{hint}</Text>
        </Pressable>
      )}
      {error ? <Banner tone="danger" message={error} /> : null}
      <ConfirmSheet
        visible={sheet}
        title={label}
        onClose={() => setSheet(false)}
        actions={[
          { title: "Take photo", variant: "secondary", onPress: () => void choose("camera") },
          { title: "Choose from gallery", variant: "secondary", onPress: () => void choose("library") },
          { title: "Cancel", variant: "ghost", onPress: () => setSheet(false) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { ...typography.label, color: colors.ink },
  drop: {
    minHeight: 76, borderRadius: radii.md, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.borderStrong,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", gap: 6, padding: spacing.md,
  },
  dropText: { ...typography.caption, color: colors.inkMuted, textAlign: "center" },
  previewWrap: { borderRadius: radii.md, overflow: "hidden" },
  preview: { width: "100%", height: 150, borderRadius: radii.md },
  clear: { position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
});
