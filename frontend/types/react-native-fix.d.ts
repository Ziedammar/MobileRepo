// React 19 + React Native type compatibility fix
// These types differ in React 19's @types/react vs React Native's expected types

import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    children?: React.ReactNode;
  }
  interface TextProps {
    children?: React.ReactNode;
  }
  interface ScrollViewProps {
    children?: React.ReactNode;
  }
  interface SafeAreaViewProps {
    children?: React.ReactNode;
  }
  interface TouchableOpacityProps {
    children?: React.ReactNode;
  }
  interface ImageProps {
    children?: React.ReactNode;
  }
}
