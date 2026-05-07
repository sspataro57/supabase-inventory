import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.inventory.app",
  appName: "Inventory",
  // In production: point at your Vercel deployment URL
  // For local dev with live-reload: use `npx cap run android --livereload --external`
  server: {
    url: process.env.WEB_URL ?? "https://your-inventory-app.vercel.app",
    cleartext: false,
  },
  plugins: {
    CapacitorPreferences: {},
    BarcodeScanning: {
      // MLKit model automatically downloaded on first scan
    },
  },
  android: {
    buildOptions: {
      keystorePath: "release.keystore",
      keystoreAlias: "inventory",
    },
  },
};

export default config;
