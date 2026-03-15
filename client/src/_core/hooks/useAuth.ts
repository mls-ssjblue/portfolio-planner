import { trpc } from "@/lib/trpc";
import { useCallback, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

// Single-user mode: always return authenticated owner user.
export function useAuth(_options?: UseAuthOptions) {
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logout = useCallback(async () => {
    // No-op in single-user mode
  }, []);

  const state = useMemo(() => {
    // Always treat as authenticated; use server data when available
    const serverUser = meQuery.data;
    const user = serverUser ?? {
      id: 1,
      openId: "owner",
      name: "Owner",
      email: null,
      loginMethod: "single-user",
      role: "admin" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    return {
      user,
      loading: false,
      error: null,
      isAuthenticated: true,
    };
  }, [meQuery.data]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
