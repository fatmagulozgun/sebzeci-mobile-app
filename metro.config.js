const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  resolver: {
    blockList: [
      /node_modules[\/\\]react-native-worklets[\/\\]android[\/\\]\.cxx[\/\\].*/,
      /node_modules[\/\\]react-native-reanimated[\/\\]android[\/\\]\.cxx[\/\\].*/,
      /node_modules[\/\\]react-native-worklets[\/\\]android[\/\\]build[\/\\].*/,
      /node_modules[\/\\]react-native-reanimated[\/\\]android[\/\\]build[\/\\].*/,
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
