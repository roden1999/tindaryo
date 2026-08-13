import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PIN_KEY = 'tindaryo.owner-pin';
const BIOMETRIC_KEY = 'tindaryo.biometric-unlock';

const getValue = async (key: string) => {
  if (Platform.OS === 'web') return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
};

const saveValue = async (key: string, value: string) => {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
};

const deleteValue = async (key: string) => {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
};

export const security = {
  hasPin: async () => Boolean(await getValue(PIN_KEY)),

  setPin: async (pin: string) => {
    if (!/^\d{4,6}$/.test(pin)) throw new Error('Use a 4 to 6 digit PIN.');
    await saveValue(PIN_KEY, pin);
  },

  removePin: async () => {
    await Promise.all([deleteValue(PIN_KEY), deleteValue(BIOMETRIC_KEY)]);
  },

  verifyPin: async (pin: string) => (await getValue(PIN_KEY)) === pin,

  canUseBiometrics: async () => Platform.OS !== 'web' && (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()),

  hasBiometricUnlockEnabled: async () => (await getValue(BIOMETRIC_KEY)) === 'enabled',

  canUnlockWithBiometrics: async () => (await getValue(BIOMETRIC_KEY)) === 'enabled' && security.canUseBiometrics(),

  setBiometricUnlock: async (enabled: boolean) => {
    if (!enabled) {
      await deleteValue(BIOMETRIC_KEY);
      return true;
    }
    if (!(await security.canUseBiometrics())) throw new Error('Set up fingerprint or Face ID in your device settings first.');
    const confirmed = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Enable biometric unlock',
      promptDescription: 'Confirm your identity to use biometrics for Tindaryo',
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use device passcode',
    });
    if (!confirmed.success) return false;
    await saveValue(BIOMETRIC_KEY, 'enabled');
    return true;
  },

  authenticateBiometric: async () => {
    const response = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Tindaryo',
      promptDescription: 'Open your private store records',
      cancelLabel: 'Use PIN',
      fallbackLabel: 'Use device passcode',
    });
    return response.success;
  },
};
