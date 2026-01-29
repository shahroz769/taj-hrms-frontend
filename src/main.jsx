import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.jsx";
import { store } from "./redux/store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data remains fresh for 5 minutes before refetching
      staleTime: 1000 * 60 * 5,
      // Cache data for 30 minutes before garbage collection
      gcTime: 1000 * 60 * 30,
      // Don't refetch when window regains focus (reduces unnecessary requests)
      refetchOnWindowFocus: false,
      // Retry failed requests up to 1 time
      retry: 1,
      // Don't refetch on component remount if data is fresh
      refetchOnMount: false,
      // Don't refetch when reconnecting to network if data is fresh
      refetchOnReconnect: false,
      // Structural sharing for efficient re-renders
      // Only updates references for data that actually changed
      structuralSharing: true,
      // Network mode: always fetch when requested, use cache as fallback
      networkMode: "offlineFirst",
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      // Network mode for mutations
      networkMode: "offlineFirst",
    },
  },
});

createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </Provider>,
);
