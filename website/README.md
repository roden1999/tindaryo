# Tindaryo website

This product website is a separate React + Vite project. It does not share runtime dependencies with the React Native application.

## Local development

```bash
cd website
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The static website is written to `website/dist`. It includes the landing page, `privacy-policy.html`, and `support.html`.

## Enable the Google Play button

After the production listing is public, create `website/.env.production`:

```env
VITE_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=com.roden.tindaryo
```

Build again. Until this variable is set, every Google Play button displays **Coming soon**.
