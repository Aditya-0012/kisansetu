import { QueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "./api";

// A 401 almost always means "your session expired" rather than "retry me" —
// retrying it just spams the server, so we special-case it out of the
// default retry policy. Everything else gets a couple of gentle retries,
// which matters on the flaky mobile connectivity this app is designed for
// (spec section on low-connectivity mode).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403 || error.status === 404)) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
