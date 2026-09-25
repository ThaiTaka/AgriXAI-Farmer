// Jest stand-in for the native WebView: renders a plain View carrying the
// props, so tests can assert what page a screen would load.
const React = require('react');
const {View} = require('react-native');

function WebView(props) {
  return React.createElement(View, {...props, testID: props.testID ?? 'webview'});
}

module.exports = WebView;
module.exports.default = WebView;
module.exports.WebView = WebView;
