const { withAndroidManifest, withMainActivity } = require('@expo/config-plugins');

// react-native-health-connect's own app.plugin.js only adds the permissions-
// rationale intent-filter. It doesn't declare the READ_STEPS permission, the
// Health Connect package-visibility <queries> entry, or wire up
// HealthConnectPermissionDelegate in MainActivity - all required for the
// permission-request flow to work, and all lost on every `expo prebuild`
// since android/ is gitignored (CNG). This plugin fills those three gaps.

const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';

function withHealthConnectManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    manifest['uses-permission'] = manifest['uses-permission'] || [];
    const hasReadSteps = manifest['uses-permission'].some(
      (entry) => entry.$['android:name'] === 'android.permission.health.READ_STEPS',
    );
    if (!hasReadSteps) {
      manifest['uses-permission'].push({ $: { 'android:name': 'android.permission.health.READ_STEPS' } });
    }

    manifest.queries = manifest.queries || [];
    const hasHealthConnectQuery = manifest.queries.some((entry) =>
      (entry.package || []).some((pkg) => pkg.$['android:name'] === HEALTH_CONNECT_PACKAGE),
    );
    if (!hasHealthConnectQuery) {
      manifest.queries.push({ package: [{ $: { 'android:name': HEALTH_CONNECT_PACKAGE } }] });
    }

    return config;
  });
}

function withHealthConnectMainActivity(config) {
  return withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('HealthConnectPermissionDelegate')) {
      contents = contents.replace(
        'import expo.modules.ReactActivityDelegateWrapper',
        'import expo.modules.ReactActivityDelegateWrapper\nimport dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate',
      );
      contents = contents.replace(
        'setTheme(R.style.AppTheme);\n    super.onCreate(null)',
        'setTheme(R.style.AppTheme);\n    super.onCreate(null)\n    HealthConnectPermissionDelegate.setPermissionDelegate(this)',
      );
      config.modResults.contents = contents;
    }

    return config;
  });
}

module.exports = function withHealthConnect(config) {
  config = withHealthConnectManifest(config);
  config = withHealthConnectMainActivity(config);
  return config;
};
