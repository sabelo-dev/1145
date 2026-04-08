## Emergency Panic Response System — Implementation Plan

### What Already Exists
- `SOSButton.tsx` (basic passenger SOS)
- `passengerSecurityService.ts` (SOS trigger, emergency contacts, safety alerts)
- `trackingService.ts` (GPS tracking)
- DB tables: `safety_alerts`, `emergency_contacts`, `compliance_audit_log`

### Phase 1: Database Migration
Create `emergency_events` table (distinct from safety_alerts) with:
- `user_id`, `role` (driver/rider), `trip_id`, `status` (active/dispatched/resolved/cancelled)
- `lat`, `lng`, `silent_mode`, `resolved_at`, `responder_notes`
- RLS policies for user access + admin full access

### Phase 2: Enhanced Panic Button Component
- **New `PanicButton.tsx`** — universal component for both driver & rider
  - 2-second long-press to trigger (prevents accidental taps)
  - Red circular button, high contrast, always visible
  - Vibration + visual feedback on trigger
  - Silent mode option (no sound)
  - 5-second cancel countdown after trigger
  - "Help is on the way" confirmation screen
  - Auto-captures GPS, falls back to last known location

### Phase 3: Emergency Event Service
- **New `emergencyService.ts`** — dedicated service:
  - `createEmergencyEvent()` — creates event, starts tracking, notifies contacts
  - `cancelEmergencyEvent()` — cancel within grace period
  - `resolveEmergencyEvent()` — admin resolves
  - `getActiveEmergencies()` — admin view
  - `dispatchResponder()` — mock dispatch (partner-ready architecture)
  - Real-time subscription via Supabase Realtime

### Phase 4: Integration Points
- **Driver Dashboard**: Add persistent PanicButton to sidebar/header
- **Ride Screen**: Replace basic SOSButton with enhanced PanicButton
- **Admin Safety Center**: Add emergency events panel with:
  - Live map of active emergencies
  - Event details (user, trip, location)
  - Manual dispatch + resolve controls
  - Real-time updates via Supabase channel

### Files Created/Modified
- **New**: `src/components/emergency/PanicButton.tsx`
- **New**: `src/components/emergency/EmergencyConfirmation.tsx`
- **New**: `src/services/emergencyService.ts`
- **New**: `src/components/admin/EmergencyMonitor.tsx`
- **Modified**: `src/components/driver/DriverDashboard.tsx` (add panic button)
- **Migration**: `emergency_events` table with RLS
