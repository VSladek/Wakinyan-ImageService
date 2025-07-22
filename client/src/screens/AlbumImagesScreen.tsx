import React, { useEffect, useState } from "react";
import {
  View,
  FlatList,
  Image,
  Button,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { APIService } from "../services/APIService";
import * as ImagePicker from "expo-image-picker";
import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation";

type Props = StackScreenProps<RootStackParamList, "AlbumImages">;

export default function AlbumImagesScreen({ route }: Props) {
  const { albumId } = route.params;
  const { apiKey, username } = useAuth();
  const [images, setImages] = useState<{ id: number; filename: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadImages = async () => {
    if (!apiKey || !username) return;
    setLoading(true);
    try {
      const data = await APIService.getAlbumImages(
        { apiKey, username },
        albumId,
      );
      setImages(data.images);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadImages();
  }, [apiKey, username]);

  const pickAndUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (!result.canceled && result.assets[0] && apiKey && username) {
      try {
        const res = await APIService.uploadImage(
          { apiKey, username },
          albumId,
          result.assets[0].uri,
        );
        Alert.alert("Success", res.message);
        loadImages();
      } catch (e: any) {
        Alert.alert("Upload Failed", e.message);
      }
    }
  };

  if (loading)
    return <ActivityIndicator size="large" style={{ marginTop: 20 }} />;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={images}
        numColumns={3}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Image
            source={{ uri: APIService.getImageUrl(item.filename) }}
            style={{ flex: 1 / 3, height: 120 }}
          />
        )}
        ListHeaderComponent={
          <Button title="Upload Image" onPress={pickAndUpload} />
        }
      />
    </View>
  );
}
