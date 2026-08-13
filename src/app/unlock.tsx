import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { Button, Card, Field } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { security } from '@/services/security';

export default function UnlockScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [view, setView] = useState({ pin: '', checking: false, biometrics: false, error: '' });

  useEffect(() => { security.canUnlockWithBiometrics().then((biometrics) => setView((current) => ({ ...current, biometrics }))); }, []);

  const unlockPin = async () => {
    setView((current) => ({ ...current, checking: true, error: '' }));
    if (await security.verifyPin(view.pin)) router.replace('/home');
    else setView((current) => ({ ...current, checking: false, pin: '', error: 'Incorrect PIN. Try again.' }));
  };

  const unlockBiometric = async () => {
    setView((current) => ({ ...current, checking: true, error: '' }));
    if (await security.authenticateBiometric()) router.replace('/home');
    else setView((current) => ({ ...current, checking: false }));
  };

  return <SafeAreaView style={styles.safe}><View style={styles.hero}><Image source={require('../../assets/images/tindaryo-icon.png')} style={styles.logo} /><Text style={styles.brand}>Tindaryo</Text><Text style={styles.caption}>{t('recordsLocked')}</Text></View><Card style={styles.card}><Field label={t('ownerPin')} secureTextEntry keyboardType="number-pad" maxLength={6} placeholder="••••" value={view.pin} onChangeText={(pin) => setView((current) => ({ ...current, pin: pin.replace(/\D/g, '') }))} onSubmitEditing={unlockPin} />{view.error ? <Text style={styles.error}>{view.error}</Text> : null}<Button title={t('unlock')} loading={view.checking} disabled={view.pin.length < 4} onPress={unlockPin} />{view.biometrics ? <Button title={t('useBiometrics')} variant="secondary" icon={<AppIcon name="finger-print-outline" color={colors.primary} />} onPress={unlockBiometric} /> : null}</Card></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary, justifyContent: 'flex-end' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  logo: { width: 82, height: 82, borderRadius: 25 },
  brand: { color: '#fff', fontSize: 31, fontWeight: '900' },
  caption: { color: 'rgba(255,255,255,0.75)' },
  card: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderWidth: 0, padding: 24, gap: 14 },
  error: { color: colors.danger, fontWeight: '700' },
});
