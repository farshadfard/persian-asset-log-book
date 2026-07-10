import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.farshadfard.sarmayeman",
  appName: "سرمایه من",
  webDir: "dist-android",
  android: {
    allowMixedContent: false,
  },
};

export default config;
