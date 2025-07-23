module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      [
        "babel-preset-expo",
        {
          jsxImportSource: "react",
          jsxRuntime: "classic", // Changed from "automatic" to fix interop issues
        },
      ],
    ],
    plugins: [
      // Add transform runtime for better interop support
      [
        "@babel/plugin-transform-runtime",
        {
          helpers: true,
          regenerator: true,
        },
      ],
      // Module resolver for absolute imports
      [
        "module-resolver",
        {
          root: ["./src"],
          extensions: [".ios.js", ".android.js", ".js", ".jsx", ".ts", ".tsx", ".json"],
          alias: {
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
          },
        },
      ],
      // React Native Reanimated plugin (must be last)
      "react-native-reanimated/plugin",
    ],
  };
};
