/**
 * JWT storage.
 *
 * The token lives in the iOS Keychain / Android Keystore-backed store, never in
 * AsyncStorage. AsyncStorage on Android is an unencrypted SQLite file inside the
 * app sandbox — readable by anyone with adb access or root on the farmer's
 * phone. `react-native-keychain` hands it to the platform keystore instead.
 */

import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.thaitaka.agrilogapp.auth';

export interface StoredSession {
  token: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    role: string;
    phone: string | null;
    region: string | null;
  };
}

/**
 * Keychain stores a username/password pair, so the JWT goes in the password
 * slot and the profile JSON rides along in the username slot. Keeping both in
 * one entry means there is no window where a token exists without its user.
 */
export async function saveSession(session: StoredSession): Promise<void> {
  await Keychain.setGenericPassword(JSON.stringify(session.user), session.token, {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const stored = await Keychain.getGenericPassword({service: SERVICE});
    if (!stored) return null;
    return {token: stored.password, user: JSON.parse(stored.username)};
  } catch (error) {
    // A corrupt or unreadable entry must not brick the app — drop it and make
    // the farmer log in again.
    console.warn('[auth] could not read the stored session', error);
    await clearSession();
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await Keychain.resetGenericPassword({service: SERVICE});
}

/** Used by the diagnostics screen and the Giai đoạn 1 acceptance test. */
export async function hasSession(): Promise<boolean> {
  return Keychain.hasGenericPassword({service: SERVICE});
}

/**
 * Which hardware backs the store on this device — SECURE_HARDWARE means the
 * Android StrongBox/TEE holds the key, SECURE_SOFTWARE means it is encrypted but
 * kept in software. Reported by the diagnostics helper, never gates login.
 */
export async function securityLevel(): Promise<string> {
  try {
    const level = await Keychain.getSecurityLevel();
    return level ? String(level) : 'unknown';
  } catch {
    return 'unknown';
  }
}

export const AUTH_KEYCHAIN_SERVICE = SERVICE;
