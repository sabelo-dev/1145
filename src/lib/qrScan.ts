// The browser's built-in QR reader (Chrome / Edge on Android, Samsung Internet).
// Safari and Firefox don't have it; there, the phone's camera app opens 1145 Pay links.
export interface DetectedCode { rawValue: string }
export interface BarcodeDetectorLike { detect: (source: HTMLVideoElement) => Promise<DetectedCode[]> }
type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

export const QrDetector = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;

export const canScanInBrowser =
  typeof QrDetector === "function" && typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
