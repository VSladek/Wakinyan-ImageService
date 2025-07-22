import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { useAuth, Role } from "../context/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import AlbumsScreen from "../screens/AlbumsScreen";
import AlbumImagesScreen from "../screens/AlbumImagesScreen";
import AdminApprovalScreen from "../screens/AdminApprovalScreen";

export type RootStackParamList = {
  Login: undefined;
  Albums: undefined;
  AlbumImages: { albumId: number; albumName: string };
  AdminApproval: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function RootNav({
  initialRouteName,
}: {
  initialRouteName: keyof RootStackParamList;
}) {
  const { role } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRouteName}>
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="Albums" component={AlbumsScreen} />
        <Stack.Screen
          name="AlbumImages"
          component={AlbumImagesScreen}
          options={({ route }) => ({ title: route.params.albumName })}
        />

        {role === Role.Admin && (
          <Stack.Screen
            name="AdminApproval"
            component={AdminApprovalScreen}
            options={{ title: "Approve Images" }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
