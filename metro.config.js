const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

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

// Performance optimizations
config.transformer.minifierConfig = {
  // Optimize bundle size
  keep_fnames: true,
  mangle: {
    keep_fnames: true,
  },
  compress: {
    drop_console: process.env.NODE_ENV === "production",
  },
};

// Enable hermes for better performance
config.transformer.hermesCommand = "hermes";

// Configure caching for faster builds
config.cacheStores = [
  {
    name: "filesystem",
    options: {
      cacheDirectory: "./node_modules/.cache/metro",
    },
  },
];

// Optimize resolver for React Native
config.resolver.platforms = ["native", "ios", "android", "web"];

// Configure watchman for file watching
config.watchFolders = ["./src", "./assets", "./node_modules"];

// Exclude unnecessary files from bundling
config.resolver.blacklistRE = /(.*\/__tests__\/.*|.*\/\.(test|spec)\.(js|jsx|ts|tsx)$)/;

// Configure source map generation
config.serializer.createModuleIdFactory = function () {
  return function (path) {
    // Generate consistent module IDs for better caching
    return require("crypto").createHash("sha1").update(path).digest("hex").substr(0, 8);
  };
};

// Enable experimental features for better performance
config.transformer.experimentalImportSupport = true;
config.transformer.inlineRequires = true;

// Configure for React Native Reanimated
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

// Support for Flipper in development
if (process.env.NODE_ENV === "development") {
  config.resolver.resolverMainFields = ["react-native", "browser", "main"];
  config.transformer.enableBabelRCLookup = true;
}

module.exports = config;
