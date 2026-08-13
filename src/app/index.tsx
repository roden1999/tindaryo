import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { store } from '@/database/store';
import { security } from '@/services/security';

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    Promise.all([store.isConfigured(), security.hasPin()])
      .then(([configured, hasPin]) => router.replace(!configured ? '/setup' : hasPin ? '/unlock' : '/home'))
      .catch(() => router.replace('/setup'));
  }, [router]);

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/images/tindaryo-icon.png')} style={styles.logo} />
      <Text style={styles.title}>Tindaryo</Text>
      <ActivityIndicator color="#fff" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, gap: 12 },
  logo: { width: 104, height: 104, borderRadius: 28 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900' },
  spinner: { marginTop: 18 },
});
