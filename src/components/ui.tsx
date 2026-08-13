import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, shadows } from '@/constants/theme';
import { AppIcon } from '@/components/app-icon';
import { useI18n } from '@/i18n';

export const Page = ({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) => {
  const content = scroll ? (
    <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={styles.pageContent}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export const Card = ({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const Field = ({ label, error, placeholder, ...props }: TextInputProps & { label: string; error?: string }) => {
  const { tr } = useI18n();
  return <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{tr(label)}</Text>
    <TextInput placeholder={typeof placeholder === 'string' ? tr(placeholder) : placeholder} placeholderTextColor={colors.muted} style={[styles.input, error && styles.inputError]} {...props} />
    {error ? <Text style={styles.errorText}>{tr(error)}</Text> : null}
  </View>;
};

export const Button = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  icon,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: ReactNode;
}) => {
  const { tr } = useI18n();
  return <Pressable
    accessibilityRole="button"
    disabled={disabled || loading}
    onPress={onPress}
    style={({ pressed }) => [
      styles.button,
      styles[`button_${variant}`],
      (disabled || loading) && styles.buttonDisabled,
      pressed && styles.pressed,
    ]}
  >
    {loading ? <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? colors.primary : '#fff'} /> : icon}
    <Text style={[styles.buttonText, styles[`buttonText_${variant}`]]}>{tr(title)}</Text>
  </Pressable>
};

export const ScreenState = ({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading?: boolean;
  error?: string;
  empty?: string;
  onRetry?: () => void;
}) => {
  const { t, tr } = useI18n();
  if (loading) return <View style={styles.state}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.muted}>{t('loading')}</Text></View>;
  if (error) return <View style={styles.state}><AppIcon name="alert-circle-outline" size={34} color={colors.warning} /><Text style={styles.stateTitle}>{t('couldNotLoad')}</Text><Text style={styles.mutedCenter}>{tr(error)}</Text>{onRetry ? <Button title={t('tryAgain')} variant="secondary" onPress={onRetry} /> : null}</View>;
  if (empty) return <View style={styles.state}><AppIcon name="file-tray-outline" size={34} color={colors.muted} /><Text style={styles.stateTitle}>{tr(empty)}</Text></View>;
  return null;
};

export const SectionTitle = ({ children, action }: PropsWithChildren<{ action?: ReactNode }>) => {
  const { tr } = useI18n();
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{typeof children === 'string' ? tr(children) : children}</Text>{action}</View>;
};

export const Pill = ({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) => {
  const { tr } = useI18n();
  return <View style={[styles.pill, styles[`pill_${tone}`]]}><Text style={[styles.pillText, styles[`pillText_${tone}`]]}>{tr(label)}</Text></View>;
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  pageContent: { flexGrow: 1, gap: 16, padding: 16, paddingBottom: 32 },
  card: { backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 16, ...shadows.card },
  fieldWrap: { gap: 7 },
  fieldLabel: { color: colors.text, fontWeight: '700', fontSize: 14 },
  input: { minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 15, color: colors.text, fontSize: 16 },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: 13 },
  button: { minHeight: 52, borderRadius: 16, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  button_primary: { backgroundColor: colors.primary },
  button_secondary: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary },
  button_danger: { backgroundColor: colors.danger },
  button_ghost: { backgroundColor: 'transparent' },
  buttonDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.82 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  buttonText_primary: { color: '#fff' },
  buttonText_secondary: { color: colors.primaryDark },
  buttonText_danger: { color: '#fff' },
  buttonText_ghost: { color: colors.primary },
  state: { flex: 1, minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  stateIcon: { fontSize: 34 },
  stateTitle: { color: colors.text, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  muted: { color: colors.muted },
  mutedCenter: { color: colors.muted, textAlign: 'center', lineHeight: 21 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { color: colors.text, fontWeight: '900', fontSize: 20 },
  pill: { alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#EDF1F0' },
  pill_neutral: { backgroundColor: '#EDF1F0' },
  pill_success: { backgroundColor: colors.successSoft },
  pill_warning: { backgroundColor: colors.warningSoft },
  pill_danger: { backgroundColor: colors.dangerSoft },
  pillText: { fontWeight: '800', fontSize: 12, color: colors.muted },
  pillText_neutral: { color: colors.muted },
  pillText_success: { color: colors.success },
  pillText_warning: { color: colors.warning },
  pillText_danger: { color: colors.danger },
});
