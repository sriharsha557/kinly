import { Platform } from 'react-native';

// Android-only for phase 1 (see ROADMAP.md "Automatic accountability / health
// integration"). Import lazily so this module is a no-op — and never touches
// a native module that doesn't exist — on iOS/web.
type HealthConnectModule = typeof import('react-native-health-connect');

let modulePromise: Promise<HealthConnectModule> | null = null;
function loadModule(): Promise<HealthConnectModule> {
  if (!modulePromise) {
    modulePromise = import('react-native-health-connect');
  }
  return modulePromise;
}

export type HealthConnectStatus = 'unavailable' | 'needs-install' | 'available';

export async function getHealthConnectStatus(): Promise<HealthConnectStatus> {
  if (Platform.OS !== 'android') return 'unavailable';
  const { getSdkStatus, SdkAvailabilityStatus } = await loadModule();
  const status = await getSdkStatus();
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) return 'unavailable';
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'needs-install';
  return 'available';
}

export async function requestStepsReadPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const { initialize, requestPermission } = await loadModule();
  const ready = await initialize();
  if (!ready) return false;
  const granted = await requestPermission([{ accessType: 'read', recordType: 'Steps' }]);
  return granted.some((p) => p.recordType === 'Steps' && p.accessType === 'read');
}

/** Total steps recorded so far today (midnight local time -> now). */
export async function readTodaysSteps(): Promise<number> {
  if (Platform.OS !== 'android') return 0;
  const { aggregateRecord, initialize } = await loadModule();
  await initialize();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const result = await aggregateRecord({
    recordType: 'Steps',
    timeRangeFilter: {
      operator: 'between',
      startTime: startOfDay.toISOString(),
      endTime: new Date().toISOString(),
    },
  });
  return result.COUNT_TOTAL ?? 0;
}

export async function openHealthConnectSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const { openHealthConnectSettings } = await loadModule();
  openHealthConnectSettings();
}
