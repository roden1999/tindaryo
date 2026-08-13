import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { Button, Card, Field } from '@/components/ui';
import { colors } from '@/constants/theme';
import { store } from '@/database/store';
import { useI18n } from '@/i18n';
import { errorMessage } from '@/utils/format';

export default function SetupScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [fdata, setData] = useState({ storeName: '', loading: false, error: '' });

  const finishSetup = async () => {
    if (!fdata.storeName.trim()) {
      setData((current) => ({ ...current, error: 'Enter the name of your store.' }));
      return;
    }
    setData((current) => ({ ...current, loading: true, error: '' }));
    try {
      await store.completeSetup(fdata.storeName);
      router.replace('/home');
    } catch (error) {
      setData((current) => ({ ...current, loading: false, error: errorMessage(error) }));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.hero}>
        <Image source={require('../../assets/images/tindaryo-icon.png')} style={styles.brandMark} contentFit="cover" />
        <Text style={styles.brand}>Tindaryo</Text>
        <Text style={styles.tagline}>{t('setupTagline')}</Text>
        <View style={styles.benefits}>
          <Benefit icon="cloud-offline-outline" label={t('worksOffline')} />
          <Benefit icon="phone-portrait-outline" label={t('dataStays')} />
          <Benefit icon="flash-outline" label={t('quickUse')} />
        </View>
      </View>
      <Card style={styles.card}>
        <View style={styles.stepBadge}><Text style={styles.stepText}>{t('oneStep')}</Text></View>
        <Text style={styles.title}>{t('nameStore')}</Text>
        <Text style={styles.caption}>{t('nameStoreCaption')}</Text>
        <Field label="Store name" placeholder="e.g. Aling Nena’s Store" autoFocus value={fdata.storeName} onChangeText={(storeName) => setData((current) => ({ ...current, storeName }))} onSubmitEditing={finishSetup} />
        {fdata.error ? <Text style={styles.error}>{fdata.error}</Text> : null}
        <Button title={t('startTindaryo')} loading={fdata.loading} icon={<AppIcon name="arrow-forward" color="#fff" />} onPress={finishSetup} />
        <Text style={styles.privacy}>{t('noAccount')}</Text>
      </Card>
    </SafeAreaView>
  );
}

const Benefit = ({ icon, label }: { icon: Parameters<typeof AppIcon>[0]['name']; label: string }) => (
  <View style={styles.benefit}><AppIcon name={icon} size={18} color="#fff" /><Text style={styles.benefitText}>{label}</Text></View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.primary, justifyContent: 'flex-end' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  brandMark: { width: 82, height: 82, borderRadius: 25, marginBottom: 15 },
  brand: { color: '#fff', fontSize: 33, fontWeight: '900', letterSpacing: -1 },
  tagline: { color: 'rgba(255,255,255,0.78)', fontSize: 15, textAlign: 'center', marginTop: 7, lineHeight: 22 },
  benefits: { flexDirection: 'row', gap: 8, marginTop: 20 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.13)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 99 },
  benefitText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  card: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderWidth: 0, gap: 15, padding: 24, paddingBottom: 28 },
  stepBadge: { alignSelf: 'flex-start', backgroundColor: colors.primarySoft, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  stepText: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  caption: { color: colors.muted, lineHeight: 21, marginTop: -7 },
  error: { color: colors.danger, fontWeight: '600' },
  privacy: { color: colors.muted, fontSize: 11, textAlign: 'center' },
});
