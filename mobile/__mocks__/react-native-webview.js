// Jest stand-in for the native WebView: renders a plain View carrying the
// props, so tests can assert what page a screen would load. Its ref answers
// injectJavaScript and keeps what was injected in `injected`, so tests can
// assert what a screen told the page to do.
const React = require('react');
const {View} = require('react-native');

const injected = [];

const WebView = React.forwardRef(function WebView(props, ref) {
  React.useImperativeHandle(ref, () => ({
    injectJavaScript: script => injected.push(script),
  }));
  return React.createElement(View, {...props, testID: props.testID ?? 'webview'});
});

module.exports = WebView;
module.exports.default = WebView;
module.exports.WebView = WebView;
module.exports.__injected = injected;
