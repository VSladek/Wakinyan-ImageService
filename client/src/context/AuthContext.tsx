import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

// The Role enum is still useful for type-safe comparisons
export enum Role {
  Admin = "admin",
  Consumer = "consumer",
}

interface AuthContextType {
  // These are now read-only, determined at build time
  readonly role: Role;
  readonly apiKey: string;

  // This is the only state we manage at runtime
  username: string | null;
  isLoggedIn: boolean;
  isLoading: boolean;

  login: (username: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Get build-time constants
const buildRole = Constants.expoConfig!.extra!.role as Role;
const buildApiKey = Constants.expoConfig!.extra!.apiKey as string;

const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAuth = async () => {
      const storedUsername = await AsyncStorage.getItem("user_username");
      if (storedUsername) {
        setUsername(storedUsername);
      }
      setIsLoading(false);
    };
    loadAuth();
  }, []);

  const login = async (newUsername: string) => {
    setUsername(newUsername);
    await AsyncStorage.setItem("user_username", newUsername);
  };

  const logout = async () => {
    setUsername(null);
    await AsyncStorage.removeItem("user_username");
  };

  return (
    <AuthContext.Provider
      value={{
        role: buildRole,
        apiKey: buildApiKey,
        username,
        isLoggedIn: !!username,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
