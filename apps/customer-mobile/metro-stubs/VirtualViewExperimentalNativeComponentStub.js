// Stub for react-native's internal
// src/private/components/virtualview/VirtualViewExperimentalNativeComponent.js.
//
// That file's Flow types (a DirectEventHandler over an event payload with
// nested `Readonly<{...}>` rects) trip up @react-native/codegen in this
// Expo SDK 57 / React Native 0.86.3 combination — a real upstream codegen
// bug, not a version mismatch (both are pinned to matching 0.86.3). It backs
// `unstable_VirtualView`, an experimental API this app never uses, so it's
// safe to swap in a plain View here rather than block the whole module
// (react-native/index.js imports it unconditionally at module-eval time).
import { View } from 'react-native';
export default View;
