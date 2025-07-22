import React, { useState } from "react";
import { Button, View, Text, StyleSheet, TextInput, Alert } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { login, role } = useAuth();
  const [username, setUsername] = useState("");

  const handleLogin = () => {
    const userToLogin = username.trim();

    if (!userToLogin) {
      Alert.alert("Username Required", "Please enter a username.");
      return;
    }
    login(userToLogin);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Image Service</Text>
      <Text style={styles.subtitle}>({role.toUpperCase()})</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter your username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

      <View style={styles.buttonContainer}>
        <Button title="Login" onPress={handleLogin} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: { fontSize: 28, fontWeight: "bold" },
  subtitle: { fontSize: 16, color: "#666", marginBottom: 40 },
  input: {
    height: 40,
    width: "80%",
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  buttonContainer: { width: "80%" },
});
