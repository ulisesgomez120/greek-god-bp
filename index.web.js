// Web-specific entry point with polyfills for Node 22+ compatibility
import "react-native-url-polyfill/auto";

// Fix for Node 22+ compatibility issues
if (typeof global === "undefined") {
  var global = globalThis;
}

// Polyfill for _interopRequireDefault issues
if (typeof require !== "undefined" && !require.interopRequireDefault) {
  require.interopRequireDefault = function (obj) {
    return obj && obj.__esModule ? obj : { default: obj };
  };
}

// Import the main app
import { registerRootComponent } from "expo";
import App from "./App";

// Register the root component
registerRootComponent(App);
