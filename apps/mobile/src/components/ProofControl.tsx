import { useState } from "react";
import { ImagePlus, X } from "lucide-react-native";
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radii, spacing, typography } from "@/theme/tokens";
import { isApiError } from "@/api/ApiError";
import { pickImage, type PickedImage, type PickSource } from "@/platform/imagePicker";
import { ConfirmSheet } from "./ConfirmSheet";
import { IconButton } from "./IconButton";
import { useToast } from "./ToastProvider";

export interface ProofControlProps {
  /** What the photo is, e.g. "receipt" or "proof of payment": used in the sheet titles. */
  noun: string;
  /** Link text shown when there is no photo yet. */
  addLabel: string;
  hasPhoto: boolean;
  /** Local file of the downloaded photo; undefined while it is still loading. */
  photoUri?: string;
  photoFailed?: boolean;
  onRetry: () => void;
  onUpload: (image: PickedImage) => Promise<unknown>;
  onRemove: () => Promise<unknown>;
}

/** A compact photo slot: a thumbnail to open, replace or remove, or a link to add one. */
export function ProofControl({ noun, addLabel, hasPhoto, photoUri, photoFailed, onRetry, onUpload, onRemove }: ProofControlProps) {
  const toast = useToast();
  const [picker, setPicker] = useState(false);
  const [viewer, setViewer] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function choose(source: PickSource) {
    setPicker(false);
    try {
      const image = await pickImage(source);
      if (!image) return;
      setUploading(true);
      await onUpload(image);
      toast.show({ message: "Photo saved", tone: "success" });
    } catch (e) {
      const msg =
        e instanceof Error && e.name === "CameraPermissionError"
          ? "Camera access is off. Allow it in your phone's settings, or use the gallery."
          : isApiError(e) && e.status === 413
            ? "That photo is too large (max 5 MB)."
            : isApiError(e) && e.status === 0
              ? "Couldn't reach MiniLedger. Check your connection."
              : "Couldn't save the photo. Try again.";
      toast.show({ message: msg, tone: "error" });
    } finally {
      setUploading(false);
    }
  }

  async function doRemove() {
    setRemoving(true);
    try {
      await onRemove();
      setViewer(false);
      toast.show({ message: "Photo removed", tone: "info" });
    } catch {
      toast.show({ message: "Couldn't remove the photo. Try again.", tone: "error" });
    } finally {
      setRemoving(false);
      setConfirmRemove(false);
    }
  }

  return (
    <>
      {uploading ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.slot} />
      ) : hasPhoto ? (
        <Pressable onPress={() => setViewer(true)} accessibilityLabel={`View ${noun}`} style={styles.slot}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.loading]}>
              {photoFailed ? <Text style={styles.retry} onPress={onRetry}>Retry</Text> : <ActivityIndicator size="small" color={colors.primary} />}
            </View>
          )}
        </Pressable>
      ) : (
        <Pressable onPress={() => setPicker(true)} accessibilityLabel={addLabel} hitSlop={8} style={({ pressed }) => [styles.add, pressed ? { opacity: 0.6 } : null]}>
          <ImagePlus size={16} color={colors.primary} />
          <Text style={styles.addText}>{addLabel}</Text>
        </Pressable>
      )}

      <ConfirmSheet
        visible={picker}
        title={`Add ${noun}`}
        onClose={() => setPicker(false)}
        actions={[
          { title: "Take photo", variant: "secondary", onPress: () => void choose("camera") },
          { title: "Choose from gallery", variant: "secondary", onPress: () => void choose("library") },
          { title: "Cancel", variant: "ghost", onPress: () => setPicker(false) },
        ]}
      />
      <ConfirmSheet
        visible={confirmRemove}
        title={`Remove this ${noun}?`}
        body="The photo is deleted. Everything else stays."
        onClose={() => { if (!removing) setConfirmRemove(false); }}
        actions={[
          { title: "Remove photo", variant: "danger", loading: removing, onPress: () => void doRemove() },
          { title: "Keep it", variant: "secondary", onPress: () => setConfirmRemove(false) },
        ]}
      />
      <Modal visible={viewer} animationType="fade" onRequestClose={() => setViewer(false)}>
        <View style={styles.viewer}>
          {photoUri ? <Image source={{ uri: photoUri }} style={styles.viewerImg} resizeMode="contain" accessibilityLabel={noun} /> : null}
          <View style={styles.viewerClose}>
            <IconButton icon={X} onPress={() => setViewer(false)} accessibilityLabel="Close" color={colors.onPrimary} />
          </View>
          <View style={styles.viewerBar}>
            <Pressable onPress={() => { setViewer(false); setPicker(true); }} hitSlop={8}><Text style={styles.viewerAction}>Replace</Text></Pressable>
            <Pressable onPress={() => setConfirmRemove(true)} hitSlop={8}><Text style={[styles.viewerAction, { color: "#FDA29B" }]}>Remove</Text></Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  slot: { marginLeft: spacing.sm },
  thumb: { width: 44, height: 44, borderRadius: radii.sm, backgroundColor: colors.surfaceMuted },
  loading: { alignItems: "center", justifyContent: "center" },
  retry: { ...typography.caption, color: colors.primary },
  add: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: spacing.sm },
  addText: { ...typography.caption, fontFamily: fonts.bodyBold, color: colors.primary },
  viewer: { flex: 1, backgroundColor: "#000000", alignItems: "center", justifyContent: "center" },
  viewerImg: { width: "100%", height: "100%" },
  viewerClose: { position: "absolute", top: 47 + spacing.sm, right: spacing.sm },
  viewerBar: { position: "absolute", bottom: 48, flexDirection: "row", gap: spacing.xxl },
  viewerAction: { ...typography.bodyStrong, color: colors.onPrimary },
});
