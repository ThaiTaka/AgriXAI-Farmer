module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // WatermelonDB models use legacy decorators (@field, @text, @relation...).
    // Must stay ahead of any other plugin that touches class properties.
    ['@babel/plugin-proposal-decorators', {legacy: true}],
  ],
};
