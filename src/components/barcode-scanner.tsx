import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { colors } from '@/constants/theme';

export const BarcodeScanner = ({
  visible,
  onClose,
  onScanned,
}: {
  visible: boolean;
  onClose: () => void;
  onScanned: (value: string) => void;
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState({ scanned: false, torch: false });

  const handleScanned = (result: BarcodeScanningResult) => {
    if (scanState.scanned) return;
    setScanState((current) => ({ ...current, scanned: true }));
    onScanned(result.data);
  };

  return (
    <Modal visible={visible} animationType="slide" onShow={() => setScanState({ scanned: false, torch: false })} onRequestClose={onClose}>
      <View style={styles.container}>
        {!permission ? (
          <View style={styles.permission}><Text style={styles.permissionText}>Checking camera permission…</Text></View>
        ) : !permission.granted ? (
          <View style={styles.permission}>
            <Text style={styles.icon}>📷</Text>
            <Text style={styles.title}>Camera access is required</Text>
            <Text style={styles.permissionText}>Allow camera access to scan product barcodes.</Text>
            <Button title="Allow camera" onPress={requestPermission} />
            <Button title="Cancel" variant="ghost" onPress={onClose} />
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={scanState.torch}
              onBarcodeScanned={scanState.scanned ? undefined : handleScanned}
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
            />
            <View style={styles.overlay}>
              <View style={styles.topBar}>
                <Pressable onPress={onClose} style={styles.roundButton}><Text style={styles.roundText}>✕</Text></Pressable>
                <Text style={styles.scanTitle}>Scan barcode</Text>
                <Pressable onPress={() => setScanState((current) => ({ ...current, torch: !current.torch }))} style={styles.roundButton}><Text style={styles.roundText}>{scanState.torch ? '🔦' : '💡'}</Text></Pressable>
              </View>
              <View style={styles.frame} />
              <Text style={styles.hint}>Place the barcode inside the frame</Text>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#081412' },
  permission: { flex: 1, justifyContent: 'center', padding: 28, gap: 16, backgroundColor: colors.background },
  icon: { fontSize: 52, textAlign: 'center' },
  title: { color: colors.text, fontSize: 23, fontWeight: '900', textAlign: 'center' },
  permissionText: { color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  overlay: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingBottom: 70, backgroundColor: 'rgba(0,0,0,0.18)' },
  topBar: { width: '100%', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  roundText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  scanTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  frame: { width: '78%', aspectRatio: 1.7, borderWidth: 3, borderColor: '#fff', borderRadius: 22, backgroundColor: 'transparent' },
  hint: { color: '#fff', fontSize: 16, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 99, paddingHorizontal: 18, paddingVertical: 10 },
});
