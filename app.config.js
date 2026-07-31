// Wraps app.json so android.googleServicesFile can come from an EAS file
// environment variable (GOOGLE_SERVICES_JSON) on EAS builds - the real
// google-services.json is gitignored (it was briefly committed and then
// purged; the repo is public), so it never reaches git or the EAS upload.
// Local prebuilds keep using the file on disk when the env var is absent.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});
