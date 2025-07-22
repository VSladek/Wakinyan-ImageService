"use client";

import type React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { LoginScreen } from "../screens/LoginScreen";
import { AlbumsScreen } from "../screens/AlbumsScreen";
import { TouchableOpacity, Text } from "react-native";
import { SyncScreen } from "../screens/SyncScreen";
import { GalleryScreen } from "../screens/GalleryScreen";
import Constants from "expo-constants";
import { PendingImagesScreen } from "../screens/PendingImagesScreen";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Simplified - no more pending tab for admin
const AdminTabs = () => {
  const { logout } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === "Albums") {
            iconName = focused ? "folder" : "folder-outline";
          } else if (route.name === "Sync") {
            iconName = focused ? "sync" : "sync-outline";
          } else {
            iconName = "help-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "gray",
        headerRight: () => (
          <TouchableOpacity
            onPress={logout}
            style={{ marginRight: 16, padding: 8 }}
          >
            <Text style={{ color: "#007AFF" }}>Logout</Text>
          </TouchableOpacity>
        ),
      })}
    >
      <Tab.Screen name="Albums" component={AlbumsScreen} />
      <Tab.Screen name="Pending" component={PendingImagesScreen} />
      <Tab.Screen name="Sync" component={SyncScreen} />
    </Tab.Navigator>
  );
};

const ConsumerTabs = () => {
  const { logout } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === "Albums") {
            iconName = focused ? "folder" : "folder-outline";
          } else if (route.name === "Sync") {
            iconName = focused ? "sync" : "sync-outline";
          } else {
            iconName = "help-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "gray",
        headerRight: () => (
          <TouchableOpacity
            onPress={logout}
            style={{ marginRight: 16, padding: 8 }}
          >
            <Text style={{ color: "#007AFF" }}>Logout</Text>
          </TouchableOpacity>
        ),
      })}
    >
      <Tab.Screen name="Albums" component={AlbumsScreen} />
      <Tab.Screen name="Sync" component={SyncScreen} />
    </Tab.Navigator>
  );
};

const MainStack = () => {
  const { user } = useAuth();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Main"
        component={
          Constants.expoConfig!.extra!.role === "admin"
            ? AdminTabs
            : ConsumerTabs
        }
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AlbumImages"
        component={GalleryScreen}
        options={({ route }) => ({
          headerBackTitleVisible: false,
          title: route.params?.albumName || "Images",
        })}
      />
    </Stack.Navigator>
  );
};

export const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null; // You could add a loading screen here
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainStack /> : <LoginScreen />}
    </NavigationContainer>
  );
};
