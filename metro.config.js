const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add support for additional file extensions
config.resolver.assetExts.push(
  // Fonts
  "otf",
  "ttf",
  "woff",
  "woff2",
  // Images
  "svg",
  "webp",
  // Audio
  "mp3",
  "wav",
  "aac",
  // Video
  "mp4",
  "mov",
  "avi",
  // Data
  "json",
  "csv"
);

// Add support for TypeScript and JavaScript source maps
config.resolver.sourceExts.push("jsx", "js", "ts", "tsx", "json", "mjs", "cjs");

// Configure module resolution for absolute imports
config.resolver.alias = {
  "@": "./src",
  "@/components": "./src/components",
  "@/screens": "./src/screens",
  "@/services": "./src/services",
  "@/utils": "./src/utils",
  "@/types": "./src/types",
  "@/config": "./src/config",
  "@/hooks": "./src/hooks",
  "@/store": "./src/store",
  "@/assets": "./assets",
};

// Configure resolver for React Native with web-specific entry points
config.resolver.platforms = ["native", "ios", "android", "web"];

// Add platform-specific entry points
config.resolver.resolverMainFields = ["react-native", "browser", "main"];

// Configure for React Native Reanimated and web compatibility
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: false,
  },
});

// Web-specific configuration for Node 22+ compatibility
// Removed unstable resolver overrides (metro defaults are used).
// These overrides caused an expo doctor warning: "resolver.unstable_enableSymlinks" mismatch.

module.exports = config;
