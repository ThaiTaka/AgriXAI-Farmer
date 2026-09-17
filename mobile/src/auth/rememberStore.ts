/**
 * "Lưu thông tin đăng nhập" — remembers the identifier the farmer typed, never
 * the password.
 *
 * It rides in a second Keychain entry rather than AsyncStorage for the reason
 * given in tokenStore.ts (AsyncStorage on Android is a plain SQLite file), and
 * because the app has no AsyncStorage dependency to begin with. Keychain wants
 * a username/password pair, so the identifier goes in the username slot and the
 * password slot carries a constant marker.
 */

import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.thaitaka.agrilogapp.remember';
const MARKER = 'remembered-identifier';

export async function saveRememberedIdentifier(identifier: string): Promise<void> {
  const trimmed = identifier.trim();
  if (!trimmed) {
    await clearRememberedIdentifier();
    return;
  }
  try {
    await Keychain.setGenericPassword(trimmed, MARKER, {service: SERVICE});
  } catch (error) {
    // Remembering is a convenience — never let it block a successful login.
    console.warn('[auth] could not remember the identifier', error);
  }
}

export async function loadRememberedIdentifier(): Promise<string | null> {
  try {
    const stored = await Keychain.getGenericPassword({service: SERVICE});
    return stored && stored.username ? stored.username : null;
  } catch (error) {
    console.warn('[auth] could not read the remembered identifier', error);
    return null;
  }
}

export async function clearRememberedIdentifier(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({service: SERVICE});
  } catch (error) {
    console.warn('[auth] could not clear the remembered identifier', error);
  }
}

export const REMEMBER_KEYCHAIN_SERVICE = SERVICE;
