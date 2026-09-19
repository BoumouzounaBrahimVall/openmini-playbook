# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Host-defined APIs

`src/api/host-apis.ts` is the one place the super-app registers
`mini.host.invoke` handlers (bridge-protocol §5.1), passed to
`MiniAppProvider` as `customApis`. A mini-app must declare `host:<name>` in
its manifest to call one. Registered today:

- `openUrl` `{ url }` — opens an http(s) link in the system browser via
  `Linking.openURL`. Other schemes are refused.

Keep the object a module-level constant; the provider memoizes on it.
