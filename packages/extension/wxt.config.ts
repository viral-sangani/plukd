import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: (env) => ({
    name: "Plukd Extension",
    version: "1.0.0",
    description: "Plukd Extension - AI-powered X/Twitter reply assistant integrated with Plukd",

    icons: {
      16: "icons/icon16.png",
      48: "icons/icon48.png",
      128: "icons/icon128.png"
    },

    permissions: [
      "storage",
      "activeTab",
      "contextMenus",
      "alarms"
    ],
    host_permissions: [
      "https://twitter.com/*",
      "https://x.com/*",
      "https://pro.x.com/*",
      "http://localhost:3000/*",
      "https://api.plukd.xyz/*"
    ],
    action: {
      default_title: "Plukd Extension",
      default_icon: {
        16: "icons/icon16.png",
        48: "icons/icon48.png",
        128: "icons/icon128.png"
      }
    },
    options_ui: {
      page: "options.html",
      open_in_tab: true
    },
    web_accessible_resources: [
      {
        resources: ["*.css"], // WXT handles CSS content scripts usually, but keeping for safety if manually injected
        matches: ["https://twitter.com/*", "https://x.com/*", "https://pro.x.com/*"]
      }
    ]
  }),
  hooks: {
    'build:manifestGenerated': (wxt, manifest) => {
      if (manifest.options_ui) {
        manifest.options_ui.open_in_tab = true;
      }
    },
  },
});
