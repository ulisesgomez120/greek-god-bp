module.exports = function (api) {
  api.cache(true);

  const isProduction = process.env.NODE_ENV === "production";
  const isDevelopment = process.env.NODE_ENV === "development";

  return {
    presets: [
      [
        "babel-preset-expo",
        {
          jsxImportSource: "react",
          jsxRuntime: "automatic",
        },
      ],
    ],
    plugins: [
      // React Native Reanimated plugin (must be last)
      "react-native-reanimated/plugin",

      // Redux Toolkit support
      ["@babel/plugin-proposal-decorators", { legacy: true }],

      // Performance optimizations
      [
        "@babel/plugin-transform-runtime",
        {
          helpers: true,
          regenerator: false,
          useESModules: true,
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

      // Inline environment variables
      [
        "transform-inline-environment-variables",
        {
          include: [
            "NODE_ENV",
            "EXPO_PUBLIC_SUPABASE_URL",
            "EXPO_PUBLIC_SUPABASE_ANON_KEY",
            "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY",
            "EXPO_PUBLIC_API_URL",
            "EXPO_PUBLIC_ENABLE_ANALYTICS",
          ],
        },
      ],

      // Development-only plugins
      ...(isDevelopment
        ? [
            // Flipper integration
            ["@babel/plugin-transform-react-jsx-source"],
            ["@babel/plugin-transform-react-jsx-self"],
          ]
        : []),

      // Production optimizations
      ...(isProduction
        ? [
            // Remove console statements in production
            [
              "transform-remove-console",
              {
                exclude: ["error", "warn"],
              },
            ],

            // Dead code elimination
            ["babel-plugin-transform-remove-undefined"],
          ]
        : []),
    ],

    // Environment-specific configurations
    env: {
      development: {
        plugins: [
          // Hot reloading support
          "react-refresh/babel",
        ],
      },
      production: {
        plugins: [
          // Bundle size optimizations
          [
            "babel-plugin-transform-imports",
            {
              "react-native-vector-icons": {
                transform: "react-native-vector-icons/dist/${member}",
                preventFullImport: true,
              },
              "date-fns": {
                transform: "date-fns/${member}",
                preventFullImport: true,
              },
            },
          ],
        ],
      },
      test: {
        presets: [["babel-preset-expo", { jsxImportSource: "react" }]],
        plugins: [
          // Test environment specific plugins
          "babel-plugin-dynamic-import-node",
        ],
      },
    },
  };
};
