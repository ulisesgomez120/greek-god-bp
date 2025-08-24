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

// Register a service worker for PWA behavior (if supported). Uses a simple registration
// strategy that logs lifecycle events and notifies when new content is available.
// Keep the registration guarded so it doesn't run in environments without navigator.serviceWorker.
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  // Defer registration until window load so assets are available
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((registration) => {
        console.log("ServiceWorker registration successful:", registration);

        // Listen for updates to the service worker.
        if (registration.installing) {
          registration.installing.onstatechange = () => {
            console.log("ServiceWorker installing state:", registration.installing?.state);
          };
        }

        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;
          installingWorker.onstatechange = () => {
            if (installingWorker.state === "installed") {
              if (navigator.serviceWorker.controller) {
                // New content available
                console.log("New content is available; please refresh.");
              } else {
                // Content cached for offline use
                console.log("Content cached for offline use.");
              }
            }
          };
        };
      })
      .catch((err) => {
        console.warn("ServiceWorker registration failed:", err);
      });
  });
}
