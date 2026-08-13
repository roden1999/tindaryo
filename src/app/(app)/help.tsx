import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { Card, Page } from '@/components/ui';
import { colors } from '@/constants/theme';

const Guide = ({ number, title, children }: { number: string; title: string; children: string }) => (
  <View style={styles.guideRow}>
    <View style={styles.number}><Text style={styles.numberText}>{number}</Text></View>
    <View style={styles.copy}><Text style={styles.guideTitle}>{title}</Text><Text style={styles.body}>{children}</Text></View>
  </View>
);

export default function HelpScreen() {
  return (
    <Page>
      <Card style={styles.hero}><View style={styles.heroIcon}><AppIcon name="help-buoy-outline" size={28} color={colors.primary} /></View><View style={styles.copy}><Text style={styles.title}>Tindaryo help</Text><Text style={styles.body}>A quick guide for running an offline sari-sari store inventory safely.</Text></View></Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Daily workflow</Text>
        <Guide number="1" title="Add products">Enter prices and opening stock. Add a barcode when available for faster selling.</Guide>
        <Guide number="2" title="Record every sale">Choose Paid, Partial, or Utang. Partial payments count as cash collected today; only the remaining balance stays in the customer ledger.</Guide>
        <Guide number="3" title="Record expenses">Add cash and digital expenses so daily cashflow and profit remain useful.</Guide>
        <Guide number="4" title="Settle utang">Open a customer ledger to record partial or full payments. Only write off a balance when it is no longer collectible.</Guide>
        <Guide number="5" title="Back up weekly">Save a full JSON backup to a folder you control. Keep a second copy outside the phone before reinstalling or changing devices.</Guide>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy summary</Text>
        <Text style={styles.body}>Tindaryo does not require an account and has no Tindaryo cloud server. Products, sales, customers, utang, expenses, and settings are stored in the app’s local SQLite database on this device.</Text>
        <Text style={styles.body}>Camera access is used only while scanning barcodes. Tindaryo does not save photos. Biometric checks are performed by the phone’s operating system; Tindaryo does not receive or store fingerprint or face data.</Text>
        <Text style={styles.body}>Notifications are generated from local store records. A backup or export leaves the app only when you explicitly choose a folder or share destination. The destination app or storage provider then handles that copy under its own policy.</Text>
        <Text style={styles.body}>Erasing app data or uninstalling can permanently remove local records. Tindaryo cannot recover records unless you previously created a full backup.</Text>
        <Text style={styles.effective}>Privacy notice effective August 13, 2026 · Tindaryo 1.0</Text>
      </Card>

      <Card style={styles.tip}><AppIcon name="shield-checkmark-outline" color={colors.success} /><Text style={styles.tipText}>Protect your device with a screen lock and enable the optional Tindaryo owner PIN when the phone is shared.</Text></Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  heroIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  copy: { flex: 1, gap: 4 },
  title: { color: colors.text, fontSize: 21, fontWeight: '900' },
  body: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  section: { gap: 16 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  guideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  number: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  numberText: { color: colors.primaryDark, fontWeight: '900' },
  guideTitle: { color: colors.text, fontWeight: '800' },
  effective: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, backgroundColor: colors.successSoft },
  tipText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 20, fontWeight: '600' },
});
