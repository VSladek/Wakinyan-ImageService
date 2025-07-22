import { registerRootComponent } from 'expo';
import App from './App';
import { StrictMode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const AppWrap = () => (
  // This wrapper provides the context for the new touch system.
  <StrictMode>
    <App />
  </StrictMode>
);

registerRootComponent(AppWrap);
