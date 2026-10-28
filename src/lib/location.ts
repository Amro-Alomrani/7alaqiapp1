import { Capacitor } from '@capacitor/core';
import { runLocationRequest } from './location-request.ts';

export interface DeviceLocationOptions extends PositionOptions { signal?: AbortSignal }

export interface DevicePosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
}

export interface DeviceLocationError {
  /** Browser-compatible error code: 1 permission, 2 unavailable, 3 timeout. */
  code: number;
  message: string;
  /** Native Capacitor code, retained for development diagnostics only. */
  nativeCode?: string;
}

const NATIVE_CODES: Record<string, number> = {
  '0002': 2,
  '0003': 1,
  '0007': 2,
  '0008': 2,
  '0009': 2,
  '0010': 3,
  '0014': 2,
  '0015': 2,
  '0016': 2,
  '0017': 2,
  '0018': 2,
};

const NO_RETRY_NATIVE_CODES = new Set(['0003', '0007', '0008', '0009', '0014', '0015', '0016', '0017', '0018']);

function normalizeLocationError(error: unknown): DeviceLocationError {
  const value = error && typeof error === 'object' ? error as { code?: unknown; message?: unknown; nativeCode?: unknown } : {};
  const rawCode = value.code;
  const pluginMatch = typeof rawCode === 'string' ? rawCode.match(/OS-PLUG-GLOC-(\d{4})$/) : null;
  const existingNativeMatch = typeof value.nativeCode === 'string' ? value.nativeCode.match(/OS-PLUG-GLOC-(\d{4})$/) : null;
  const nativeCode = pluginMatch?.[1] ?? existingNativeMatch?.[1];
  const browserCode = typeof rawCode === 'number' && [1, 2, 3].includes(rawCode) ? rawCode : undefined;
  const code = browserCode ?? (nativeCode ? NATIVE_CODES[nativeCode] : undefined) ?? 2;
  const message = typeof value.message === 'string' ? value.message : 'Could not determine the device location.';
  return { code, message, ...(nativeCode ? { nativeCode: `OS-PLUG-GLOC-${nativeCode}` } : {}) };
}

function logLocationError(error: DeviceLocationError) {
  if (import.meta.env?.DEV) {
    console.warn('[location] request failed', { code: error.code, nativeCode: error.nativeCode });
  }
}

function canRetryWithApproximate(error: DeviceLocationError): boolean {
  if (error.code !== 2 && error.code !== 3) return false;
  const shortCode = error.nativeCode?.slice(-4);
  return !shortCode || !NO_RETRY_NATIVE_CODES.has(shortCode);
}

function fromNative(position: {
  latitude: number; longitude: number; accuracy: number; altitude: number | null;
  altitudeAccuracy?: number | null; heading: number | null; speed: number | null;
}, timestamp = Date.now()): DevicePosition {
  if (!Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)
    || position.latitude < -90 || position.latitude > 90
    || position.longitude < -180 || position.longitude > 180) {
    throw { code: 2, message: 'The location provider returned invalid coordinates.' } satisfies DeviceLocationError;
  }
  return {
    // Browser GeolocationCoordinates exposes prototype getters; spreading it
    // would silently lose latitude and longitude.
    coords: {
      latitude: position.latitude, longitude: position.longitude, accuracy: position.accuracy,
      altitude: position.altitude, altitudeAccuracy: position.altitudeAccuracy ?? null,
      heading: position.heading, speed: position.speed,
    },
    timestamp,
  };
}

function browserPosition(options: PositionOptions, signal?: AbortSignal): Promise<DevicePosition> {
  if (!navigator.geolocation) {
    return Promise.reject({ code: 2, message: 'Geolocation is unavailable.' } satisfies DeviceLocationError);
  }
  const timeout = options.timeout ?? 15_000;
  return runLocationRequest(() => new Promise<DevicePosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(
    position => {
      try { resolve(fromNative(position.coords, position.timestamp)); }
      catch (error) { reject(error); }
    },
    error => reject(normalizeLocationError(error)),
    { ...options, timeout },
  )), timeout, signal);
}

export async function getCurrentLocation(options: DeviceLocationOptions = {}): Promise<DevicePosition> {
  const { signal } = options;
  const requestedHighAccuracy = options.enableHighAccuracy ?? false;
  const timeout = Math.max(1, Math.min(options.timeout ?? 15_000, 60_000));
  const deadline = Date.now() + timeout;
  const remaining = () => Math.max(1, deadline - Date.now());
  const maximumAge = options.maximumAge ?? 30_000;

  if (!Capacitor.isNativePlatform()) {
    try {
      return await browserPosition({
        enableHighAccuracy: requestedHighAccuracy,
        timeout: requestedHighAccuracy ? Math.max(1, Math.floor(timeout * 0.65)) : timeout,
        maximumAge,
      }, signal);
    } catch (error) {
      const normalized = normalizeLocationError(error);
      logLocationError(normalized);
      if (signal?.aborted || !requestedHighAccuracy || !canRetryWithApproximate(normalized) || Date.now() >= deadline) throw normalized;
      try {
        return await browserPosition({
          enableHighAccuracy: false,
          timeout: remaining(),
          maximumAge,
        }, signal);
      } catch (fallbackError) {
        const fallback = normalizeLocationError(fallbackError);
        logLocationError(fallback);
        throw fallback;
      }
    }
  }

  const { Geolocation } = await runLocationRequest(() => import('@capacitor/geolocation'), remaining(), signal);
  const getPosition = async (enableHighAccuracy: boolean, attemptTimeout: number, age: number) => {
    // Let the Capacitor plugin handle permission and location-settings flows.
    // Calling checkPermissions() first can fail early while device Location is off.
    const position = await runLocationRequest(() => Geolocation.getCurrentPosition({
      enableHighAccuracy,
      timeout: attemptTimeout,
      maximumAge: age,
    }), Math.min(attemptTimeout, remaining()), signal);
    return fromNative(position.coords, position.timestamp);
  };

  // Native GPS often needs longer than a browser estimate for a cold fix.
  // Honor the caller's bounded timeout instead of cutting every GPS request to 15s.
  const primaryTimeout = requestedHighAccuracy ? Math.max(1, Math.floor(remaining() * 0.7)) : remaining();
  try {
    return await getPosition(requestedHighAccuracy, primaryTimeout, maximumAge);
  } catch (error) {
    const normalized = normalizeLocationError(error);
    logLocationError(normalized);
    if (signal?.aborted || !requestedHighAccuracy || !canRetryWithApproximate(normalized) || Date.now() >= deadline) throw normalized;
    try {
      return await getPosition(false, remaining(), maximumAge);
    } catch (fallbackError) {
      const fallback = normalizeLocationError(fallbackError);
      logLocationError(fallback);
      throw fallback;
    }
  }
}

export async function watchDeviceLocation(
  onPosition: (position: DevicePosition) => void,
  onError: (error: DeviceLocationError) => void,
  options: PositionOptions = {},
): Promise<() => void> {
  const timeoutMs = options.timeout ?? 20_000;
  let stopped = false;
  let receivedFix = false;
  let firstFixTimer: ReturnType<typeof setTimeout> | undefined;
  const clearFirstFixTimer = () => {
    if (firstFixTimer) clearTimeout(firstFixTimer);
    firstFixTimer = undefined;
  };
  const positionReceived = (position: DevicePosition) => {
    if (stopped) return;
    receivedFix = true;
    clearFirstFixTimer();
    onPosition(position);
  };
  const locationError = (error: unknown) => {
    if (stopped) return;
    const normalized = normalizeLocationError(error);
    logLocationError(normalized);
    if (!receivedFix) clearFirstFixTimer();
    onError(normalized);
  };
  const stop = (clearNativeWatch?: () => void) => {
    stopped = true;
    clearFirstFixTimer();
    clearNativeWatch?.();
  };

  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import('@capacitor/geolocation');
    let clearNativeWatch: (() => void) | undefined;
    try {
      const id = await Geolocation.watchPosition({
        enableHighAccuracy: options.enableHighAccuracy ?? false,
        timeout: timeoutMs,
        maximumAge: options.maximumAge ?? 5_000,
      }, (position, error) => {
        if (error) { locationError(error); return; }
        if (position) {
          try { positionReceived(fromNative(position.coords, position.timestamp)); }
          catch (invalidPosition) { locationError(invalidPosition); }
        }
      });
      clearNativeWatch = () => { void Geolocation.clearWatch({ id }); };
      if (stopped) clearNativeWatch();
    } catch (error) {
      stop(clearNativeWatch);
      throw normalizeLocationError(error);
    }
    if (!receivedFix && !stopped) {
      firstFixTimer = setTimeout(() => locationError({ code: 3, message: 'Location timed out before the first fix.' }), timeoutMs + 2_000);
    }
    return () => stop(clearNativeWatch);
  }

  if (!navigator.geolocation) {
    locationError({ code: 2, message: 'Geolocation is unavailable.' });
    stop();
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    position => positionReceived(position),
    error => locationError(error),
    { ...options, timeout: timeoutMs },
  );
  firstFixTimer = setTimeout(() => locationError({ code: 3, message: 'Location timed out before the first fix.' }), timeoutMs + 2_000);
  return () => stop(() => navigator.geolocation.clearWatch(id));
}
