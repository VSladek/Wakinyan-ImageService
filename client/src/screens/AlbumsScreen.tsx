import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Alert,
  Button,
  TouchableOpacity,
} from "react-native";
import { useAuth, Role } from "../context/AuthContext";
import { APIService } from "../services/APIService";
import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation";

type Props = StackScreenProps<RootStackParamList, "Albums">;

export default function AlbumsScreen({ navigation }: Props) {
  const { role, username, apiKey, logout } = useAuth();
  const [albums, setAlbums] = useState<{ id: number; name: string }[]>([]);

  const loadAlbums = async () => {
    if (!apiKey || !username) return;
    try {
      const data = await APIService.getAlbums({ apiKey, username });
      setAlbums(data.albums);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => <Button title="Logout" onPress={logout} color="red" />,
      title: `Albums (${username})`,
    });
    loadAlbums();
  }, [apiKey, username]);

  const createAlbum = () => {
    Alert.prompt("New Album", "Enter album name:", async (name) => {
      if (name && apiKey && username) {
        await APIService.createAlbum({ apiKey, username }, name);
        loadAlbums();
      }
    });
  };

  return (
    <View style={{ flex: 1 }}>
      {role === Role.Admin && (
        <View style={{ padding: 10 }}>
          <Button title="Create Album" onPress={createAlbum} />
          <View style={{ marginTop: 10 }} />
          <Button
            title="Approve Images"
            onPress={() => navigation.navigate("AdminApproval")}
          />
        </View>
      )}
      <FlatList
        data={albums}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{ padding: 20, borderBottomWidth: 1, borderColor: "#ccc" }}
            onPress={() =>
              navigation.navigate("AlbumImages", {
                albumId: item.id,
                albumName: item.name,
              })
            }
          >
            <Text style={{ fontSize: 18 }}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
