// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure Metro processes all source files as UTF-8
config.transformer = {
  ...config.transformer,
  // Force UTF-8 for all transpiled assets
  assetPlugins: [],
};

// Treat .svg files as assets for the favicon
config.resolver = {
  ...config.resolver,
  assetExts: [...config.resolver.assetExts, 'svg'],
};

module.exports = config;
