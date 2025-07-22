// app.config.js
import 'dotenv/config';

// Read the role from an environment variable. Default to 'consumer'.
const role = process.env.APP_ROLE || 'consumer';

// Define settings that are different for each role
const roleConfig = {
  admin: {
    name: 'Image Service (Admin)',
    slug: 'image-service-admin',
    bundleIdentifier: 'cz.wakinyan.imageservice.admin',
    package: 'cz.wakinyan.imageservice.admin',
    icon: './assets/icon.png',
    apiKey: process.env.ADMIN_API_KEY,
    role: 'admin',
  },
  consumer: {
    name: 'Image Service',
    slug: 'image-service-consumer',
    bundleIdentifier: 'cz.wakinyan.imageservice.consumer',
    package: 'cz.wakinyan.imageservice.consumer',
    icon: './assets/icon.png',
    apiKey: process.env.CONSUMER_API_KEY,
    role: 'consumer',
  },
};

const selectedConfig = roleConfig[role];

// Export the final configuration object
export default {
  expo: {
    // Use the role-specific settings
    name: selectedConfig.name,
    slug: selectedConfig.slug,
    ios: {
      bundleIdentifier: selectedConfig.bundleIdentifier,
    },
    android: {
      package: selectedConfig.package,
    },
    icon: selectedConfig.icon,

    // Embed the role and the correct API key into the app binary
    extra: {
      role: selectedConfig.role,
      apiKey: selectedConfig.apiKey,
      apiBaseUrl: process.env.API_BASE_URL || 'http://127.0.0.1:8080',
    },

    // Common settings for both apps
    version: '1.0.0',
    orientation: 'portrait',
    jsEngine: 'hermes',
    updates: {
      fallbackToCacheTimeout: 0,
    },
    assetBundlePatterns: ['**/*'],
  },
};
