const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Réduit la pression mémoire et évite "DataCloneError: out of memory" sur Windows/Android
config.maxWorkers = 2;
config.watcher = {
  ...config.watcher,
  unstable_workerThreads: false,
};

config.resolver = {
  ...config.resolver,
  blockList: [/APIs Groq\.txt$/],
};

module.exports = config;
