import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tryndadi.controlefinanceiro",
  appName: "Controle Financeiro",
  webDir: "public",
  server: {
    androidScheme: "https",
  },
};

export default config;
