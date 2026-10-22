import { useState } from "react";
import { ImagePlus, X } from "lucide-react-native";
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radii, spacing, typography } from "@/theme/tokens";
import { isApiError } from "@/api/ApiError";
import { usePaymentReceiptUri, useRemovePaymentReceipt, useUploadPaymentReceipt } from "@/api/queries";
import { pickImage, type PickSource } from "@/platform/imagePicker";
import type { Payment } from "@/shared/types";
import { ConfirmSheet } from "./ConfirmSheet";
import { IconButton } from "./IconButton";
import { useToast } from "./ToastProvider";

/** Proof of one payment: a thumbnail you can open, replace or remove, or a link to add one. */
export function PaymentProof({ loanId, payment }: { loanId: string; payment: Payment }) {
  const toast = useToast();
  const photo = usePaymentReceiptUri(loanId, payment.id, payment.hasReceipt);
  const upload = useUploadPaymentReceipt();
  const remove = useRemovePaymentReceipt();
  const [picker, setPicker] = useState(false);
  const [viewer, setViewer] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function choose(source: PickSource) {
    setPicker(false);
    try {
      const image = await pickImage(source);
      if (!image) return;
      await upload.mutateAsync({ loanId, paymentId: payment.id, image });
      toast.show({ message: "Proof saved", tone: "success" });
    } catch (e) {
      const msg =
        e instanceof Error && e.name === "CameraPermissionError"
          ? "Camera access is off. Allow it in your phone's settings, or use the gallery."
          : isApiError(e) && e.status === 413
            ? "That photo is too large (max 5 MB)."
            : "Couldn't save the photo. Try again.";
      toast.show({ message: msg, tone: "error" });
    }
  }

  async function doRemove() {
    try {
      await remove.mutateAsync({ loanId, paymentId: payment.id });
      setViewer(false);
      toast.show({ message: "Proof removed", tone: "info" });
    } catch {
      toast.show({ message: "Couldn't remove the photo. Try again.", tone: "error" });
    } finally {
      setConfirmRemove(false);
    }
  }

  return (
    <>
      {upload.isPending ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.slot} />
      ) : payment.hasReceipt ? (
        <Pressable onPress={() => setViewer(true)} accessibilityLabel="View payment proof" style={styles.slot}>
          {photo.data ? (
            <Image source={{ uri: photo.data }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.loading]}>{photo.isError ? <Text style={styles.retry} onPress={() => void photo.refetch()}>Retry</Text> : <ActivityIndicator size="small" color={colors.primary} />}</View>
          )}
        </Pressable>
      ) : (
        <Pressable onPress={() => setPicker(true)} accessibilityLabel="Add proof of this payment" hitSlop={8} style={({ pressed }) => [styles.add, pressed ? { opacity: 0.6 } : null]}>
          <ImagePlus size={16} color={colors.primary} />
          <Text style={styles.addText}>Add proof</Text>
        </Pressable>
      )}

      <ConfirmSheet
        visible={picker}
        title="Proof of payment"
        onClose={() => setPicker(false)}
        actions={[
          { title: "Take photo", variant: "secondary", onPress: () => void choose("camera") },
          { title: "Choose from gallery", variant: "secondary", onPress: () => void choose("library") },
          { title: "Cancel", variant: "ghost", onPress: () => setPicker(false) },
        ]}
      />
      <ConfirmSheet
        visible={confirmRemove}
        title="Remove this proof?"
        body="The photo is deleted. The payment itself stays."
        onClose={() => { if (!remove.isPending) setConfirmRemove(false); }}
        actions={[
          { title: "Remove photo", variant: "danger", loading: remove.isPending, onPress: () => void doRemove() },
          { title: "Keep it", variant: "secondary", onPress: () => setConfirmRemove(false) },
        ]}
      />
      <Modal visible={viewer} animationType="fade" onRequestClose={() => setViewer(false)}>
        <View style={styles.viewer}>
          {photo.data ? <Image source={{ uri: photo.data }} style={styles.viewerImg} resizeMode="contain" accessibilityLabel="Payment proof" /> : null}
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
