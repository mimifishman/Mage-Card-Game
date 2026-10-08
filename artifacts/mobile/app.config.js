const baseConfig = require("./app.json");

// Development builds get their own identity so the dev app and a store build
// can sit side by side on one phone. With APP_VARIANT unset (preview,
// production, the Replit dev server) nothing changes.
const IS_DEV_BUILD = process.env.APP_VARIANT === "development";

module.exports = ({ config }) => {
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  const expoDomain = process.env.REPLIT_EXPO_DEV_DOMAIN;

  const expoRouterOrigin = devDomain
    ? `https://${devDomain}:9000`
    : "https://replit.com/";

  const updatedPlugins = (config.plugins || []).map((plugin) => {
    if (Array.isArray(plugin) && plugin[0] === "expo-router") {
      return ["expo-router", { ...plugin[1], origin: expoRouterOrigin }];
    }
    return plugin;
  });

  const identity = IS_DEV_BUILD
    ? {
        name: `${config.name} Dev`,
        ios: { ...config.ios, bundleIdentifier: `${config.ios.bundleIdentifier}.dev` },
        android: { ...config.android, package: `${config.android.package}.dev` },
      }
    : {};

  return {
    ...config,
    ...identity,
    plugins: updatedPlugins,
    extra: {
      ...config.extra,
      router: {
        origin: expoRouterOrigin,
        headOrigin: expoDomain ? `https://${expoDomain}` : expoRouterOrigin,
      },
    },
  };
};
