import Constants from "expo-constants";
const API_BASE = Constants.expoConfig!.extra!.apiBaseUrl;

type AuthState = { apiKey: string; username: string };

async function apiFetch(
  path: string,
  auth: AuthState,
  options: RequestInit = {},
) {
  console.log(`API Request: ${API_BASE}${path}`, options);
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${auth.apiKey}`,
      "X-Username": auth.username,
    },
  });
  if (!res.ok) {
    const errorData = await res
      .json()
      .catch(() => ({ error: "Network error" }));
    throw new Error(errorData.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const APIService = {
  getAlbums: (auth: AuthState) => apiFetch("/api/albums/", auth),
  createAlbum: (auth: AuthState, name: string) =>
    apiFetch("/api/albums/", auth, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  getAlbumImages: (auth: AuthState, albumId: number) =>
    apiFetch(`/api/images/album/${albumId}`, auth),
  uploadImage: async (auth: AuthState, albumId: number, localUri: string) => {
    const filename = localUri.split("/").pop() || "image.jpg";
    const formData = new FormData();
    formData.append("album_id", String(albumId));
    formData.append("image", {
      uri: localUri,
      name: filename,
      type: "image/jpeg",
    } as any);
    return apiFetch("/api/images/upload", auth, {
      method: "POST",
      body: formData,
    });
  },
  getPendingImages: (auth: AuthState) => apiFetch("/api/images/pending", auth),
  approveImage: (auth: AuthState, imageId: number) =>
    apiFetch(`/api/images/${imageId}/approve`, auth, { method: "POST" }),
  rejectImage: (auth: AuthState, imageId: number) =>
    apiFetch(`/api/images/${imageId}/reject`, auth, { method: "POST" }),
  getImageUrl: (filename: string) => `${API_BASE}/api/images/${filename}`,
};
