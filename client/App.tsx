import React, { StrictMode } from "react";
import { registerRootComponent } from "expo";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "./src/contexts/AuthContext";
import { AppNavigator } from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <StrictMode>
      <AuthProvider>
        <AppNavigator />
        <StatusBar style="auto" />
      </AuthProvider>
    </StrictMode>
  );
}

registerRootComponent(App);
