# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

This project was migrated from SDK 54 to SDK 57 on 2026-09-03. Notable breaking
changes already applied (do not reintroduce them):

- `edgeToEdgeEnabled` was removed from app.json (edge-to-edge is mandatory now).
- `expo-router` no longer depends on react-navigation: import navigation theme
  types from `expo-router/react-navigation`, never from `@react-navigation/*`
  (those packages were uninstalled; reinstalling them breaks the global
  `ReactNavigation.Theme` type).
- `StyleSheet.absoluteFillObject` no longer exists in React Native 0.86.
- `expo-font`, `expo-image`, `expo-status-bar` and `expo-web-browser` must be
  listed as plugins in app.json.
