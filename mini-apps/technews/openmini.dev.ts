/**
 * Browser dev host config, picked up by `mini dev` from @openmini/cli 0.1.4
 * onwards. It stands in for the super-app's host-defined APIs so
 * `mini.host.invoke("openUrl")` works during `npm run dev`; the real host
 * registers the same name in super-app/openmini-playbook/src/api/host-apis.ts.
 */
export default {
  customApis: {
    openUrl: (payload: unknown) => {
      const url = (payload as { url?: unknown }).url;
      if (typeof url !== "string") throw new Error("openUrl expects { url }");
      window.open(url, "_blank", "noopener");
      return null;
    },
  },
};
