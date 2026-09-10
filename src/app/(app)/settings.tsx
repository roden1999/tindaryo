import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { Button, Card, Field, Page } from '@/components/ui';
import { colors } from '@/constants/theme';
import { store } from '@/database/store';
import { useI18n } from '@/i18n';
import { restoreBackupFromPicker, saveBackupToDevice, shareBackup, shareProductCsvTemplate, shareSalesCsv } from '@/services/export';
import { importProductPreview, pickProductCsv } from '@/services/product-csv';
import { security } from '@/services/security';
import { getNotificationPermission, getNotificationPreferences, requestNotificationPermission, saveNotificationPreferences, sendTestNotification, syncNotificationSchedule } from '@/services/notifications';
import type { AppLanguage, NotificationPreferences, ProductImportPreview } from '@/types';
import { errorMessage } from '@/utils/format';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { preference, setLanguage, t } = useI18n();
  const [fdata, setData] = useState({
    storeName: '', pin: '', confirmPin: '', hasPin: false, biometricsAvailable: false, biometricUnlock: false, loading: true, saving: false, action: '', importPreview: null as ProductImportPreview | null,
    notificationPreferences: { enabled: false, lowStock: true, expiry: true, overdue: true, busyForecast: false, quietForecast: false, hour: 8, minute: 0 } as NotificationPreferences,
    notificationPermission: 'undetermined' as 'granted' | 'denied' | 'undetermined' | 'unavailable', lastBackupAt: null as string | null, error: '',
  });

  useEffect(() => {
    Promise.all([store.getStoreProfile(), security.hasPin(), security.canUseBiometrics(), security.hasBiometricUnlockEnabled(), getNotificationPreferences(), getNotificationPermission(), store.getSetting('last_backup_at')])
      .then(([profile, hasPin, biometricsAvailable, biometricUnlock, notificationPreferences, notificationPermission, lastBackupAt]) => setData((current) => ({ ...current, storeName: profile.storeName, hasPin, biometricsAvailable, biometricUnlock, notificationPreferences, notificationPermission, lastBackupAt, loading: false })))
      .catch((error) => setData((current) => ({ ...current, loading: false, error: errorMessage(error) })));
  }, []);

  const save = async () => {
    if (!fdata.storeName.trim()) return setData((current) => ({ ...current, error: 'Store name is required.' }));
    setData((current) => ({ ...current, saving: true, error: '' }));
    try { await store.updateStoreName(fdata.storeName); setData((current) => ({ ...current, saving: false })); Alert.alert('Saved', 'Your store name has been updated.'); }
    catch (error) { setData((current) => ({ ...current, saving: false, error: errorMessage(error) })); }
  };

  const enablePin = async () => {
    if (fdata.pin !== fdata.confirmPin) return setData((current) => ({ ...current, error: 'PIN entries do not match.' }));
    setData((current) => ({ ...current, action: 'pin', error: '' }));
    try { await security.setPin(fdata.pin); setData((current) => ({ ...current, action: '', pin: '', confirmPin: '', hasPin: true })); Alert.alert('App lock enabled', 'Tindaryo will ask for the owner PIN the next time it opens.'); }
    catch (error) { setData((current) => ({ ...current, action: '', error: errorMessage(error) })); }
  };

  const disablePin = () => Alert.alert('Disable app lock?', 'Anyone with this device will be able to open store records.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Disable', style: 'destructive', onPress: async () => { await security.removePin(); setData((current) => ({ ...current, hasPin: false, biometricUnlock: false })); } },
  ]);

  const toggleBiometrics = async (enabled: boolean) => {
    setData((current) => ({ ...current, action: 'biometrics', error: '' }));
    try {
      const changed = await security.setBiometricUnlock(enabled);
      setData((current) => ({ ...current, action: '', biometricUnlock: enabled && changed }));
      if (enabled && changed) Alert.alert(t('biometricsEnabled'), t('biometricsEnabledBody'));
    } catch (error) { setData((current) => ({ ...current, action: '', error: errorMessage(error) })); }
  };

  const saveBackup = async () => {
    setData((current) => ({ ...current, action: 'save-backup', error: '' }));
    try { if (await saveBackupToDevice()) { const lastBackupAt = new Date().toISOString(); setData((current) => ({ ...current, lastBackupAt })); Alert.alert(t('backupSaved'), t('backupSavedBody')); } }
    catch (error) { setData((current) => ({ ...current, error: errorMessage(error) })); }
    finally { setData((current) => ({ ...current, action: '' })); }
  };

  const shareFullBackup = async () => {
    setData((current) => ({ ...current, action: 'share-backup', error: '' }));
    try { await shareBackup(); setData((current) => ({ ...current, lastBackupAt: new Date().toISOString() })); }
    catch (error) { setData((current) => ({ ...current, error: errorMessage(error) })); }
    finally { setData((current) => ({ ...current, action: '' })); }
  };

  const restore = () => Alert.alert('Replace all store data?', 'Restoring a backup replaces the current products, sales, expenses, and customer ledgers. Create a fresh backup first.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Choose backup', style: 'destructive', onPress: async () => {
      setData((current) => ({ ...current, action: 'restore', error: '' }));
      try { if (await restoreBackupFromPicker()) { Alert.alert('Restore complete', 'Your backup was restored successfully.'); router.replace('/'); } }
      catch (error) { setData((current) => ({ ...current, error: errorMessage(error) })); }
      finally { setData((current) => ({ ...current, action: '' })); }
    } },
  ]);

  const chooseProductCsv = async () => {
    setData((current) => ({ ...current, action: 'pick-products', error: '' }));
    try {
      const importPreview = await pickProductCsv();
      setData((current) => ({ ...current, action: '', importPreview }));
    } catch (error) {
      setData((current) => ({ ...current, action: '', error: errorMessage(error) }));
    }
  };

  const confirmProductImport = async () => {
    if (!fdata.importPreview?.validCount) return;
    setData((current) => ({ ...current, action: 'import-products', error: '' }));
    try {
      const response = await importProductPreview(fdata.importPreview);
      setData((current) => ({ ...current, action: '', importPreview: null }));
      Alert.alert('Import complete', response.message);
    } catch (error) {
      setData((current) => ({ ...current, action: '', error: errorMessage(error) }));
    }
  };

  const changeLanguage = async (language: AppLanguage) => {
    setData((current) => ({ ...current, action: 'language', error: '' }));
    try {
      await setLanguage(language);
      await syncNotificationSchedule();
      setData((current) => ({ ...current, action: '' }));
    } catch (error) { setData((current) => ({ ...current, action: '', error: errorMessage(error) })); }
  };

  const toggleReminders = async (enabled: boolean) => {
    setData((current) => ({ ...current, action: 'notifications', error: '' }));
    try {
      if (enabled && !(await requestNotificationPermission())) {
        setData((current) => ({ ...current, action: '', notificationPermission: current.notificationPermission === 'unavailable' ? 'unavailable' : 'denied', error: t(current.notificationPermission === 'unavailable' ? 'notificationsUnavailable' : 'notificationsDenied') }));
        return;
      }
      const notificationPreferences = { ...fdata.notificationPreferences, enabled };
      await saveNotificationPreferences(notificationPreferences);
      setData((current) => ({ ...current, action: '', notificationPreferences, notificationPermission: enabled ? 'granted' : current.notificationPermission }));
    } catch (error) { setData((current) => ({ ...current, action: '', error: errorMessage(error) })); }
  };

  const toggleReminderKind = async (key: 'lowStock' | 'expiry' | 'overdue' | 'busyForecast' | 'quietForecast', enabled: boolean) => {
    const notificationPreferences = { ...fdata.notificationPreferences, [key]: enabled };
    setData((current) => ({ ...current, notificationPreferences, action: 'notifications', error: '' }));
    try { await saveNotificationPreferences(notificationPreferences); setData((current) => ({ ...current, action: '' })); }
    catch (error) { setData((current) => ({ ...current, action: '', error: errorMessage(error) })); }
  };

  const refreshReminders = async () => {
    setData((current) => ({ ...current, action: 'refresh-reminders', error: '' }));
    try { await syncNotificationSchedule(fdata.notificationPreferences); Alert.alert(t('remindersReady'), t('remindersReadyBody')); }
    catch (error) { setData((current) => ({ ...current, error: errorMessage(error) })); }
    finally { setData((current) => ({ ...current, action: '' })); }
  };

  const testReminder = async () => {
    setData((current) => ({ ...current, action: 'test-reminder', error: '' }));
    try { await sendTestNotification(); }
    catch (error) { setData((current) => ({ ...current, error: errorMessage(error) })); }
    finally { setData((current) => ({ ...current, action: '' })); }
  };

  const eraseAllData = () => Alert.alert(t('eraseAllData'), t('eraseAllDataBody'), [
    { text: t('cancel'), style: 'cancel' },
    { text: t('erase'), style: 'destructive', onPress: () => Alert.alert(t('eraseConfirmTitle'), t('eraseConfirmBody'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('erase'), style: 'destructive', onPress: async () => {
        setData((current) => ({ ...current, action: 'erase', error: '' }));
        try {
          await saveNotificationPreferences({ ...fdata.notificationPreferences, enabled: false });
          await store.eraseAllData();
          await security.removePin();
          router.replace('/setup');
        } catch (error) { setData((current) => ({ ...current, action: '', error: errorMessage(error) })); }
      } },
    ]) },
  ]);

  const backupAge = fdata.lastBackupAt ? Date.now() - new Date(fdata.lastBackupAt).getTime() : Number.POSITIVE_INFINITY;
  const backupIsDue = !Number.isFinite(backupAge) || backupAge > 7 * 86400000;

  return (
    <Page>
      {fdata.error ? <Text style={styles.errorBox}>{fdata.error}</Text> : null}
      <Card style={styles.formCard}>
        <View style={styles.cardHeading}><View style={styles.iconBox}><AppIcon name="storefront-outline" color={colors.primary} /></View><View><Text style={styles.title}>{t('storeProfile')}</Text><Text style={styles.caption}>{t('profileCaption')}</Text></View></View>
        <Field label="Store name" value={fdata.storeName} editable={!fdata.loading} onChangeText={(storeName) => setData((current) => ({ ...current, storeName }))} />
        <Button title="Save changes" loading={fdata.saving || fdata.loading} onPress={save} />
      </Card>

      <Card style={styles.formCard}>
        <View style={styles.cardHeading}><View style={styles.iconBox}><AppIcon name="language-outline" color={colors.primary} /></View><View style={styles.headingCopy}><Text style={styles.title}>{t('language')}</Text><Text style={styles.caption}>{t('languageCaption')}</Text></View></View>
        <View style={styles.languageOptions}>{([
          ['system', t('systemLanguage')], ['en', t('english')], ['fil', t('filipino')], ['ceb', t('cebuano')],
        ] as [AppLanguage, string][]).map(([value, label]) => <Pressable key={value} disabled={fdata.action === 'language'} onPress={() => changeLanguage(value)} style={[styles.languageOption, preference === value && styles.languageOptionActive]}><Text style={[styles.languageText, preference === value && styles.languageTextActive]}>{label}</Text>{preference === value ? <AppIcon name="checkmark-circle" size={17} color="#fff" /> : null}</Pressable>)}</View>
      </Card>

      <Card style={styles.formCard}>
        <View style={styles.cardHeading}><View style={styles.iconBox}><AppIcon name="time-outline" color={colors.primary} /></View><View style={styles.headingCopy}><Text style={styles.title}>{t('weeklyStoreHours')}</Text><Text style={styles.caption}>{t('weeklyStoreHoursSettingsCaption')}</Text></View></View>
        <Button title={t('manageStoreHours')} variant="secondary" icon={<AppIcon name="calendar-outline" color={colors.primary} />} onPress={() => router.push('/store-hours' as Href)} />
        <Button title={t('viewSalesTraffic')} variant="ghost" icon={<AppIcon name="bar-chart-outline" color={colors.primary} />} onPress={() => router.push('/reports/traffic' as Href)} />
      </Card>

      <Card style={styles.formCard}>
        <View style={styles.cardHeading}><View style={styles.iconBox}><AppIcon name="notifications-outline" color={colors.primary} /></View><View style={styles.headingCopy}><Text style={styles.title}>{t('reminders')}</Text><Text style={styles.caption}>{t('remindersCaption')}</Text></View><Switch value={fdata.notificationPreferences.enabled} disabled={fdata.notificationPermission === 'unavailable' || fdata.action === 'notifications'} onValueChange={toggleReminders} trackColor={{ false: colors.border, true: colors.primary }} /></View>
        <Text style={styles.infoText}>{fdata.notificationPermission === 'unavailable' ? t('notificationsUnavailable') : fdata.notificationPermission === 'denied' ? t('notificationsDenied') : t('remindersInfo')}</Text>
        <View style={styles.reminderOptions}>
          <ReminderToggle label={t('lowStockAlerts')} value={fdata.notificationPreferences.lowStock} disabled={!fdata.notificationPreferences.enabled || fdata.action === 'notifications'} onChange={(value) => toggleReminderKind('lowStock', value)} />
          <ReminderToggle label={t('expiryAlerts')} value={fdata.notificationPreferences.expiry} disabled={!fdata.notificationPreferences.enabled || fdata.action === 'notifications'} onChange={(value) => toggleReminderKind('expiry', value)} />
          <ReminderToggle label={t('overdueAlerts')} value={fdata.notificationPreferences.overdue} disabled={!fdata.notificationPreferences.enabled || fdata.action === 'notifications'} onChange={(value) => toggleReminderKind('overdue', value)} />
          <ReminderToggle label={t('busyForecastAlerts')} value={fdata.notificationPreferences.busyForecast} disabled={!fdata.notificationPreferences.enabled || fdata.action === 'notifications'} onChange={(value) => toggleReminderKind('busyForecast', value)} />
          <ReminderToggle label={t('quietForecastAlerts')} value={fdata.notificationPreferences.quietForecast} disabled={!fdata.notificationPreferences.enabled || fdata.action === 'notifications'} onChange={(value) => toggleReminderKind('quietForecast', value)} />
        </View>
        {fdata.notificationPreferences.enabled ? <><Button title={t('refreshReminders')} variant="secondary" loading={fdata.action === 'refresh-reminders'} onPress={refreshReminders} /><Button title={t('testReminder')} variant="ghost" loading={fdata.action === 'test-reminder'} onPress={testReminder} /></> : null}
      </Card>

      <Card style={styles.formCard}>
        <View style={styles.cardHeading}><View style={styles.iconBox}><AppIcon name="cloud-download-outline" color={colors.primary} /></View><View style={styles.headingCopy}><Text style={styles.title}>{t('backupExports')}</Text><Text style={styles.caption}>{t('backupCaption')}</Text></View></View>
        <Text style={styles.infoText}>{t('backupInfo')}</Text>
        <View style={[styles.backupStatus, backupIsDue && styles.backupStatusDue]}><AppIcon name={backupIsDue ? 'warning-outline' : 'checkmark-circle-outline'} color={backupIsDue ? colors.warning : colors.success} /><View style={styles.headingCopy}><Text style={styles.backupStatusTitle}>{t('lastBackup')}: {fdata.lastBackupAt ? new Date(fdata.lastBackupAt).toLocaleString() : t('noBackupYet')}</Text><Text style={styles.caption}>{t(backupIsDue ? 'backupDue' : 'backupCurrent')}</Text></View></View>
        <Button title={t('saveBackupDevice')} loading={fdata.action === 'save-backup'} icon={<AppIcon name="folder-open-outline" color="#fff" />} onPress={saveBackup} />
        <Button title={t('shareBackup')} variant="secondary" loading={fdata.action === 'share-backup'} icon={<AppIcon name="share-social-outline" color={colors.primary} />} onPress={shareFullBackup} />
        <Button title="Export sales CSV" variant="secondary" icon={<AppIcon name="document-text-outline" color={colors.primary} />} onPress={async () => { try { await shareSalesCsv(); } catch (error) { setData((current) => ({ ...current, error: errorMessage(error) })); } }} />
        <Button title="Restore from backup" variant="ghost" loading={fdata.action === 'restore'} onPress={restore} />
      </Card>

      <Card style={styles.formCard}>
        <View style={styles.cardHeading}><View style={styles.iconBox}><AppIcon name="file-tray-full-outline" color={colors.primary} /></View><View style={styles.headingCopy}><Text style={styles.title}>{t('importProducts')}</Text><Text style={styles.caption}>{t('importCaption')}</Text></View></View>
        <Text style={styles.infoText}>{t('importInfo')}</Text>
        <Button title="Choose product CSV" loading={fdata.action === 'pick-products'} icon={<AppIcon name="cloud-upload-outline" color="#fff" />} onPress={chooseProductCsv} />
        <Button title="Get CSV template" variant="ghost" onPress={async () => { try { await shareProductCsvTemplate(); } catch (error) { setData((current) => ({ ...current, error: errorMessage(error) })); } }} />
      </Card>

      <Card style={styles.formCard}>
        <View style={styles.cardHeading}><View style={[styles.iconBox, styles.lockBox]}><AppIcon name="lock-closed-outline" color={colors.warning} /></View><View style={styles.headingCopy}><Text style={styles.title}>{t('ownerLock')}</Text><Text style={styles.caption}>{t(fdata.hasPin ? 'enabledDevice' : 'optionalShared')}</Text></View></View>
        {fdata.hasPin ? <><Text style={styles.infoText}>{t('lockInfo')}</Text>{fdata.biometricsAvailable ? <View style={styles.biometricRow}><View style={styles.biometricCopy}><Text style={styles.reminderLabel}>{t('biometricUnlock')}</Text><Text style={styles.caption}>{t('biometricUnlockCaption')}</Text></View><Switch value={fdata.biometricUnlock} disabled={fdata.action === 'biometrics'} onValueChange={toggleBiometrics} trackColor={{ false: colors.border, true: colors.primary }} /></View> : <Text style={styles.infoText}>{t('biometricsUnavailable')}</Text>}<Button title="Disable app lock" variant="danger" onPress={disablePin} /></> : <><Field label="New PIN" secureTextEntry keyboardType="number-pad" maxLength={6} placeholder="4 to 6 digits" value={fdata.pin} onChangeText={(pin) => setData((current) => ({ ...current, pin: pin.replace(/\D/g, '') }))} /><Field label="Confirm PIN" secureTextEntry keyboardType="number-pad" maxLength={6} value={fdata.confirmPin} onChangeText={(confirmPin) => setData((current) => ({ ...current, confirmPin: confirmPin.replace(/\D/g, '') }))} /><Button title="Enable app lock" loading={fdata.action === 'pin'} disabled={fdata.pin.length < 4} onPress={enablePin} /></>}
      </Card>

      <Card style={styles.infoCard}><View style={styles.iconBox}><AppIcon name="shield-checkmark-outline" color={colors.success} /></View><View style={styles.infoCopy}><Text style={styles.title}>{t('privateDefault')}</Text><Text style={styles.infoText}>{t('privateInfo')}</Text></View></Card>
      <Card style={styles.formCard}><View style={styles.cardHeading}><View style={styles.iconBox}><AppIcon name="help-circle-outline" color={colors.primary} /></View><View style={styles.headingCopy}><Text style={styles.title}>{t('helpPrivacy')}</Text><Text style={styles.caption}>{t('helpPrivacyCaption')}</Text></View></View><Button title={t('helpPrivacy')} variant="secondary" onPress={() => router.push('/help' as Href)} /></Card>
      <Card style={[styles.formCard, styles.dangerCard]}><View style={styles.cardHeading}><View style={[styles.iconBox, styles.dangerIcon]}><AppIcon name="trash-outline" color={colors.danger} /></View><View style={styles.headingCopy}><Text style={styles.title}>{t('dangerZone')}</Text><Text style={styles.caption}>{t('dangerZoneCaption')}</Text></View></View><Button title={t('eraseAllData')} variant="danger" loading={fdata.action === 'erase'} onPress={eraseAllData} /></Card>
      <Text style={styles.version}>{t('offlineEdition')}</Text>

      <Modal visible={Boolean(fdata.importPreview)} transparent animationType="slide" onRequestClose={() => setData((current) => ({ ...current, importPreview: null }))}>
        <Pressable style={styles.backdrop} onPress={() => setData((current) => ({ ...current, importPreview: null }))} />
        <View style={[styles.importSheet, { paddingBottom: Math.max(insets.bottom, 20) + 8 }]}>
          <View style={styles.importHeader}><View style={styles.headingCopy}><Text style={styles.sheetTitle}>Review product import</Text><Text numberOfLines={1} style={styles.caption}>{fdata.importPreview?.fileName}</Text></View><Pressable accessibilityLabel="Close import preview" style={styles.closeButton} onPress={() => setData((current) => ({ ...current, importPreview: null }))}><AppIcon name="close" color={colors.text} /></Pressable></View>
          <View style={styles.importCounts}><View style={styles.countBox}><Text style={styles.validCount}>{fdata.importPreview?.validCount ?? 0}</Text><Text style={styles.countLabel}>READY</Text></View><View style={[styles.countBox, styles.errorCountBox]}><Text style={styles.errorCount}>{fdata.importPreview?.errorCount ?? 0}</Text><Text style={styles.countLabel}>NEEDS FIXING</Text></View></View>
          <Text style={styles.infoText}>Only rows marked Ready will be added. No existing product will be overwritten.</Text>
          <ScrollView style={styles.previewList} contentContainerStyle={styles.previewContent}>
            {fdata.importPreview?.rows.map((row) => <View key={row.rowNumber} style={[styles.previewRow, !row.product && styles.invalidRow]}><View style={styles.rowNumber}><Text style={styles.rowNumberText}>{row.rowNumber}</Text></View><View style={styles.previewCopy}><Text numberOfLines={1} style={styles.previewName}>{row.product?.productName || `CSV row ${row.rowNumber}`}</Text><Text style={[styles.previewMeta, !row.product && styles.invalidText]}>{row.product ? `${row.product.stock} ${row.product.unit} · ₱${row.product.sellingPrice.toFixed(2)}` : row.errors.join(' · ')}</Text></View><AppIcon name={row.product ? 'checkmark-circle' : 'alert-circle'} color={row.product ? colors.success : colors.danger} /></View>)}
          </ScrollView>
          <Button title={`Import ${fdata.importPreview?.validCount ?? 0} valid products`} loading={fdata.action === 'import-products'} disabled={!fdata.importPreview?.validCount} onPress={confirmProductImport} />
          <Button title="Cancel" variant="ghost" onPress={() => setData((current) => ({ ...current, importPreview: null }))} />
        </View>
      </Modal>
    </Page>
  );
}

const ReminderToggle = ({ label, value, disabled, onChange }: { label: string; value: boolean; disabled: boolean; onChange: (value: boolean) => void }) => (
  <View style={[styles.reminderRow, disabled && styles.reminderDisabled]}><Text style={styles.reminderLabel}>{label}</Text><Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.primary }} /></View>
);

const styles = StyleSheet.create({
  formCard: { gap: 16 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingCopy: { flex: 1 },
  iconBox: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  lockBox: { backgroundColor: colors.warningSoft },
  dangerIcon: { backgroundColor: colors.dangerSoft },
  dangerCard: { borderColor: colors.dangerSoft },
  title: { color: colors.text, fontSize: 17, fontWeight: '900' },
  caption: { color: colors.muted, fontSize: 12, marginTop: 2 },
  errorBox: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 12, fontWeight: '700' },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  infoCopy: { flex: 1, gap: 5 },
  infoText: { color: colors.muted, lineHeight: 20, fontSize: 13 },
  backupStatus: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: colors.successSoft },
  backupStatusDue: { backgroundColor: colors.warningSoft },
  backupStatusTitle: { color: colors.text, fontWeight: '800', fontSize: 13 },
  biometricRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: colors.background },
  biometricCopy: { flex: 1, gap: 2 },
  version: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)' },
  importSheet: { maxHeight: '82%', backgroundColor: colors.surface, padding: 20, gap: 13, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  importHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  closeButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  importCounts: { flexDirection: 'row', gap: 10 },
  countBox: { flex: 1, padding: 14, borderRadius: 15, backgroundColor: colors.successSoft },
  errorCountBox: { backgroundColor: colors.dangerSoft },
  validCount: { color: colors.success, fontSize: 25, fontWeight: '900' },
  errorCount: { color: colors.danger, fontSize: 25, fontWeight: '900' },
  countLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  previewList: { flexGrow: 0, maxHeight: 300 },
  previewContent: { gap: 8 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.background },
  invalidRow: { borderColor: colors.dangerSoft, backgroundColor: colors.dangerSoft },
  rowNumber: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  rowNumberText: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  previewCopy: { flex: 1, gap: 3 },
  previewName: { color: colors.text, fontWeight: '800' },
  previewMeta: { color: colors.muted, fontSize: 11 },
  invalidText: { color: colors.danger },
  languageOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  languageOption: { minHeight: 42, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, flexDirection: 'row', alignItems: 'center', gap: 6 },
  languageOptionActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  languageText: { color: colors.text, fontWeight: '800', fontSize: 12 },
  languageTextActive: { color: '#fff' },
  reminderOptions: { borderWidth: 1, borderColor: colors.border, borderRadius: 15, overflow: 'hidden' },
  reminderRow: { minHeight: 52, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border },
  reminderDisabled: { opacity: 0.5 },
  reminderLabel: { flex: 1, color: colors.text, fontWeight: '700', paddingRight: 10 },
});
