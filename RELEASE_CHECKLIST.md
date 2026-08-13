# Tindaryo 1.0 release checklist

## Automated checks

Run from the project folder:

```powershell
npm run release:check
npx expo export --platform android --clear
```

The release configuration is in `eas.json`. When the Expo project and signing account are ready:

```powershell
npx eas-cli login
npx eas-cli init
npx eas-cli build --platform android --profile production
```

The production profile creates the Android App Bundle for Google Play and increments the local Android build number.

## Required manual checks

- Replace the contact placeholder in `PRIVACY_POLICY.md`, publish it at a public URL, and add that URL in Google Play Console.
- Complete the Play Data safety form using the policy and the final production build's actual permissions.
- Prepare the store description, 512 × 512 icon, 1024 × 500 feature graphic, phone screenshots, support email, and app category.
- Test upgrade migration using a copy of real pre-1.0 data; confirm products, sales, partial payments, utang, expenses, and settings remain intact.
- On at least one physical Android phone, test barcode scanning, direct backup save, backup restore, receipt PDF sharing, notifications, PIN, biometrics, partial payment, write-off, archive, and erase-all flow.
- Upload the AAB to Play internal testing and install it from Play. Do not promote to production until the internal test passes without data loss or crashes.
- Complete any Google Play closed-testing requirement shown for the developer account before requesting production access.

## Accounting behavior in 1.0

Dashboard revenue and profit use cash-basis reporting. A partial sale recognizes the payment received and the same proportion of product cost. Later payments recognize the remaining shares. Written-off balances are removed from collectible utang and their remaining exposure is reported as a loss.
