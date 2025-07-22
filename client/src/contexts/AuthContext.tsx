import type React from "react";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { apiService } from "../services/api";
import type { User } from "../types/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      await apiService.loadCredentials();
      const userData = await apiService.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.log("Not authenticated");
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string): Promise<boolean> => {
    try {
      await apiService.setCredentials(username);
      const validation = await apiService.validateCredentials();

      if (validation.valid) {
        const userData = await apiService.getCurrentUser();
        setUser(userData);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  };

  const logout = async () => {
    await apiService.clearCredentials();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
