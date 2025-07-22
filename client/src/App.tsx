import React, { StrictMode } from "react";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./context/AuthContext";
import RootNav from "./navigation";
import { ActivityIndicator, View } from "react-native";

const AppContent = () => {
  const { isLoggedIn, isLoading } = useAuth();
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return <RootNav initialRouteName={isLoggedIn ? "Albums" : "Login"} />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
