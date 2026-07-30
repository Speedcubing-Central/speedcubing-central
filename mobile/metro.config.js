// @ts-check
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Modules that MUST resolve to exactly one instance across the whole bundle,
// no matter which package is asking for them: react, use-sync-external-store
// (zustand's React binding pulls this in) confirmed duplicated in practice,
// plus react-native/scheduler as the same class of risk even though they
// weren't observed duplicated here.
//
// Root cause: npm hoists a workspace dependency to the monorepo root
// whenever no version conflict forces it to stay local, regardless of
// whether that dependency itself is React-instance-sensitive. zustand and
// @react-navigation/core/routers ended up at the repo root this way. Metro's
// default resolver walks UP from wherever the *requesting* package physically
// sits, looking for node_modules at each ancestor directory, BEFORE
// consulting its explicit nodeModulesPaths list, so zustand (at the repo
// root) finds the repo root's react (client's React 18) via that walk,
// not mobile's own React 19, producing two React instances in one bundle:
// "Invalid hook call", "Cannot read property 'useCallback' of null".
//
// A blunt fix (config.resolver.disableHierarchicalLookup = true) closes this
// but also breaks legitimate uses of the same walk-up, like `expo` itself
// resolving its own privately-nested expo-asset at
// expo/node_modules/expo-asset. So instead, only these specific
// singleton-sensitive names are forced to resolve as if requested from
// inside mobile/ itself; everything else keeps Metro's default resolution,
// walk-up included.
const SINGLETON_PACKAGES = ['react', 'react-native', 'scheduler', 'use-sync-external-store'];

// A real, existing file inside this workspace. Forcing a singleton module's
// origin here makes its walk-up start at mobile/, so the first node_modules
// it finds is mobile/node_modules, regardless of where the actual requester
// (possibly hoisted to the repo root) physically lives.
const singletonOrigin = path.join(projectRoot, 'metro.config.js');

// Matches both the bare package ('react') and its subpath imports
// ('react/jsx-runtime', 'use-sync-external-store/with-selector', both of
// which real code in this bundle actually uses) without also matching an
// unrelated package that merely starts with the same characters.
function isSingletonModule(moduleName) {
  return SINGLETON_PACKAGES.some((pkg) => moduleName === pkg || moduleName.startsWith(pkg + '/'));
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (isSingletonModule(moduleName)) {
    return context.resolveRequest({ ...context, originModulePath: singletonOrigin }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
