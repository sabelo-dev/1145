import { NativeBiometric } from "capacitor-native-biometric";

export async function authenticate(reason = "Authenticate") {
  const result = await NativeBiometric.isAvailable();

  if (!result.isAvailable) {
    return false;
  }

  try {
    await NativeBiometric.verifyIdentity({
      reason,
      title: "1145",
      subtitle: "Secure Authentication",
      description: "Verify your identity",
    });

    return true;
  } catch {
    return false;
  }
}