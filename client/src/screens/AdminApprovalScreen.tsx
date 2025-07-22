import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Button,
  StyleSheet,
  Alert,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { APIService } from "../services/APIService";

export default function AdminApprovalScreen() {
  const { apiKey, username } = useAuth();
  const [pending, setPending] = useState<{ id: number; filename: string }[]>(
    [],
  );

  const loadPending = async () => {
    if (!apiKey || !username) return;
    try {
      const data = await APIService.getPendingImages({ apiKey, username });
      setPending(data.images);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  useEffect(() => {
    loadPending();
  }, [apiKey, username]);

  const handleApprove = async (imageId: number) => {
    if (!apiKey || !username) return;
    await APIService.approveImage({ apiKey, username }, imageId);
    loadPending();
  };

  const handleReject = async (imageId: number) => {
    if (!apiKey || !username) return;
    await APIService.rejectImage({ apiKey, username }, imageId);
    loadPending();
  };

  return (
    <FlatList
      data={pending}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <Image
            source={{ uri: APIService.getImageUrl(item.filename) }}
            style={styles.image}
          />
          <View style={styles.actions}>
            <Button
              title="Approve"
              onPress={() => handleApprove(item.id)}
              color="green"
            />
            <Button
              title="Reject"
              onPress={() => handleReject(item.id)}
              color="red"
            />
          </View>
        </View>
      )}
      ListEmptyComponent={
        <Text style={{ textAlign: "center", marginTop: 20 }}>
          No images pending approval.
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  item: { padding: 10, borderBottomWidth: 1, borderColor: "#ccc" },
  image: { width: "100%", height: 200, resizeMode: "contain" },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
  },
});
