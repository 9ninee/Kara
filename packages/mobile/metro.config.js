// Expo Metro config for a pnpm monorepo.
// Without watchFolders covering the workspace root, Metro cannot resolve
// symlinked packages (expo-router/entry, @kara/shared) and bundling fails.
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..', '..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// The workspace contains two React majors (desktop uses 18.3, Expo pins 18.2).
// Force every react/react-dom/react-native import to THIS package's copy so
// the bundle never contains two React instances (symptom: "Cannot read
// properties of null (reading 'useMemo')").
const SINGLETONS = ['react', 'react-dom', 'react-native', 'react-native-web']
const defaultResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const base = moduleName.startsWith('@')
    ? moduleName.split('/').slice(0, 2).join('/')
    : moduleName.split('/')[0]
  if (SINGLETONS.includes(base)) {
    const local = path.join(projectRoot, 'node_modules', base)
    const rewritten = local + moduleName.slice(base.length)
    return (defaultResolveRequest ?? context.resolveRequest)(context, rewritten, platform)
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform)
}

module.exports = config
