# Tindaryo

Tindaryo is a modern, offline-first inventory and point-of-sale app for Filipino sari-sari stores. The name combines **tinda** and **imbentaryo**. Store data stays in an on-device SQLite database, so daily selling does not depend on an account, PHP/MySQL server, API, or internet connection.

[Privacy policy](https://roden1999.github.io/tindaryo/privacy-policy.html) · [Support](https://roden1999.github.io/tindaryo/support.html)

## What is included

- Fast POS cart with product search, barcode scanning, quick-sell items, quantity controls, and change calculation
- Cash, GCash, Maya, and split payments
- Inventory categories, units, per-product low-stock thresholds, expiry dates, restocking, and a stock movement audit trail
- Product CSV import with validation, duplicate-barcode protection, and a review screen before saving
- Customer utang ledgers with due dates, overdue indicators, partial payments, payment methods, and shareable reminders
- Sales history with refund/void support that restores stock and excludes refunded receipts from reports
- Daily expenses and cash-on-hand summary
- Dashboard, profit, sales, inventory value, best-seller, and restock reporting
- Shareable PDF receipts, native printing, and sales CSV export
- Local JSON backup and restore through the device file/share sheet
- Optional local owner PIN with biometric unlock when the device supports it
- Optional daily local reminders for low stock, upcoming expiry dates, and overdue utang
- English, Filipino, and Cebuano interfaces, with automatic device-language selection and English fallback

## Technology

- Expo SDK 57 and React Native 0.86
- Expo Router with TypeScript
- `expo-sqlite` for the local relational database
- Expo Camera for barcode scanning
- Expo FileSystem, DocumentPicker, Sharing, and Print for exports, restore, and receipts
- Expo SecureStore and LocalAuthentication for the optional app lock
- Expo Notifications for on-device reminders; no push server is used
- Expo Localization plus an in-app language selector for English, Filipino, and Cebuano

The source groups related screen state into object-based hooks, for example:

```tsx
const [form, setForm] = useState({
  firstName: '',
  lastName: '',
  error: '',
  submitting: false,
});
```

## Run locally without Expo Go or an Expo account

Prerequisites: Node.js, npm, an OpenJDK, and the Android SDK. Tindaryo retains its native `android/` project and builds locally like a normal Android React Native app. Expo libraries remain part of the application source, but Expo Go, EAS, cloud builds, and an Expo login are not required.

```bash
npm install
npm run android:test
```

`android:test` builds a standalone preview, installs it on the connected emulator or USB-debugging phone, and launches it. It does not need Metro after installation. For faster development with live reload, use `npm run android:dev`; this installs Tindaryo's own debug app rather than opening Expo Go.

### Version and Play Store bundle

Before every Play release, manually edit these two values in `app.json`:

```json
{
  "expo": {
    "version": "1.0.1",
    "android": {
      "versionCode": 2
    }
  }
}
```

`version` is the public version shown to users. `versionCode` is an integer that must increase for every Google Play upload, even for another build of the same public version.

Set up the private Play upload key once, then build the AAB:

```bash
npm run android:signing
npm run android:aab
```

The signed bundle is copied to `artifacts/android/Tindaryo-<version>-<versionCode>.aab`. Back up the generated `.jks` upload key and its password securely. The key and `android/keystore.properties` are intentionally excluded from Git.

Other local commands:

```bash
npm run android:apk  # standalone test APK
npm run android:dev  # debug app with live reload
```

Useful checks:

```bash
npm run check
npx expo export --platform android
```

## Project structure

```text
src/
  app/          Expo Router screens and layouts
  components/   Shared UI, forms, scanner, and icons
  constants/    Theme tokens
  database/     SQLite schema, migrations, and store API
  services/     Backup/export, receipt, and security services
  types/        Domain types
  utils/        Formatting helpers
assets/images/  Tindaryo app icons and artwork
```

## Offline data and safety

- SQLite data persists locally on the device. Deleting the app or clearing its app data can remove it.
- Use **Settings → Backup data** regularly and save the JSON file somewhere safe, such as Google Drive.
- Restoring replaces the current local business data after confirmation.
- The optional PIN is intentionally device-local and is not placed in backup files.
- Biometrics and PIN are a convenience/privacy lock for the store owner; they are not a multi-user authorization system.

## Languages and reminders

Choose **Device language**, **English**, **Filipino**, or **Cebuano** in Settings. The choice is saved in SQLite and is included in full backups. Any untranslated future text safely falls back to English.

Store reminders are optional and stay entirely on the device. When enabled, Tindaryo refreshes its daily schedule from the current SQLite records at startup, when the app becomes active, and after reminder settings change. The phone may deliver the reminder around 8:00 AM rather than at an exact second. Android and iPhone notification permission is requested only when the owner enables reminders.

## Product CSV import

Download the starter file from **Settings → Import products → Get CSV template**. The supported columns are:

```text
product_name,barcode,cost_price,selling_price,stock,category,unit,expiry_date,low_stock_threshold
```

`product_name`, `cost_price`, `selling_price`, and `stock` are required. Dates use `YYYY-MM-DD`. Tindaryo previews every row, skips invalid rows and duplicate barcodes, and imports at most 500 products per file.

## Recommended next releases

1. Bluetooth thermal-printer support and customizable receipt branding
2. Optional encrypted cloud sync and multi-device recovery
3. Supplier purchase orders and suggested reorder quantities
4. Loyalty points and simple promotions after the core store workflow is proven

## License

See [LICENSE](LICENSE).
