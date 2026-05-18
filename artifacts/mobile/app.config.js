const baseConfig = require("./app.json");

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

  return {
    ...config,
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
