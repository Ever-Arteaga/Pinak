// Metro (el empaquetador de Expo) debe poder leer ../shared, que está fuera de la carpeta mobile.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const sharedRoot = path.resolve(__dirname, "../shared");

config.watchFolders = [...(config.watchFolders ?? []), sharedRoot];
// Las dependencias que use shared/ (ninguna hoy) se resuelven desde mobile/node_modules.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];

module.exports = config;
