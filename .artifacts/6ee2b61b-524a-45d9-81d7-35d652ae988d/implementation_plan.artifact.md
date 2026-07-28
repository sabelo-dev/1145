# Fix "Pixel Launcher isn't responding"

The user confirms the emulator (Medium Phone) is running (PID 12404). However, ADB reports it as `offline`. This indicates a kernel hang or a crash of the internal ADB daemon, which correlates with the "Pixel Launcher isn't responding" error.

## User Review Required

> [!IMPORTANT]
> Although the emulator process is running, it is not responding to commands. A **Cold Boot** is required to restore functionality.

## Proposed Steps

### 1. Recover Emulator Connectivity
Since the emulator is hung, it needs a fresh start.
- **Action**: I will guide the user to perform a **Cold Boot** of the emulator.
- **Why**: This bypasses the saved state (snapshots) which might be carrying the crash/hang.

### 2. Clear Pixel Launcher Data (If connectivity is restored)
If the emulator comes back online but the launcher still crashes:
- **Command**: `adb shell pm clear com.google.android.apps.nexuslauncher`
- **Action**: I will attempt to run this command once the device is detected as `device` instead of `offline`.

### 3. Check for Project Conflicts
- **Action**: Verify if the current app's configuration (e.g., extremely large icons or malformed resources) could be triggering launcher crashes during indexing.

## Verification Plan

### Manual Verification
- Check `adb devices` to see if the emulator status changes to `device`.
- Use `take_screenshot` to verify the "isn't responding" dialog is gone.
- Ensure the home screen (Pixel Launcher) is visible and interactive.
