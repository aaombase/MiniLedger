// Native adapter: expo-image-picker for camera / library, expo-image-manipulator to normalize what was picked.
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { File as FsFile } from "expo-file-system";
import type { PickedImage } from "@/shared/types";

export type { PickedImage };
export type PickSource = "camera" | "library";

const MAX_WIDTH = 1600;

/** Thrown when the user refuses camera access, so the screen can explain instead of silently doing nothing. */
export class CameraPermissionError extends Error {
  constructor() {
    super("Camera access is turned off. You can enable it in your phone's settings.");
    this.name = "CameraPermissionError";
  }
}

/**
 * Lets the user pick or take a photo, then re-encodes it as a JPEG no wider than 1600 px.
 * The server only accepts JPEG/PNG/WebP up to 5 MB, and phone photos are often HEIC or 5-12 MB;
 * normalizing here makes uploads small, fast and always an accepted type. Returns null if cancelled.
 */
export async function pickImage(source: PickSource): Promise<PickedImage | null> {
  let result: ImagePicker.ImagePickerResult;
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new CameraPermissionError();
    result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
  } else {
    result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  }
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const actions: ImageManipulator.Action[] = asset.width > MAX_WIDTH
    ? [{ resize: { width: MAX_WIDTH } }]
    : [];
  const saved = await ImageManipulator.manipulateAsync(
    asset.uri, actions,
    { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 },
  );

  return { uri: saved.uri, name: `receipt-${Date.now()}.jpg`, type: "image/jpeg", size: new FsFile(saved.uri).size };
}
