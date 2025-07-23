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

// Configure resolver for React Native
config.resolver.platforms = ["native", "ios", "android", "web"];

// Configure for React Native Reanimated
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: false,
  },
});

module.exports = config;
