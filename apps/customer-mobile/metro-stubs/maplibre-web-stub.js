// MapLibre React Native is native-only. On web this stub keeps screens that import it from crashing; they show a
// short note instead of the map. (Native builds never load this file.)
const React = require('react');
const { View, Text } = require('react-native');

function Map({ style }) {
  return React.createElement(
    View,
    { style: [{ alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFE7DB' }, style] },
    React.createElement(Text, { style: { color: '#6B5B4B', padding: 16, textAlign: 'center' } }, 'The map is available in the mobile app.'),
  );
}
const Camera = React.forwardRef(function Camera(_props, ref) {
  React.useImperativeHandle(ref, () => ({ easeTo() {}, flyTo() {}, jumpTo() {}, fitBounds() {}, setStop() {} }));
  return null;
});
const Noop = () => null;

module.exports = {
  Map, Camera, Marker: Noop, Layer: Noop, GeoJSONSource: Noop, UserLocation: Noop, Callout: Noop, ViewAnnotation: Noop,
  MapView: Map, MarkerView: Noop, ShapeSource: Noop, LineLayer: Noop, CircleLayer: Noop, SymbolLayer: Noop,
};
