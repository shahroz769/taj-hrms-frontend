import "./App.css";
import { BrowserRouter, Route, Routes } from "react-router";
import LoginPage from "./pages/auth/Login";
import { useDispatch } from "react-redux";
import { login } from "./redux/slices/authSlice";
import { refreshToken } from "./services/authApi";
import { useQuery } from "@tanstack/react-query";

function App() {
  const dispatch = useDispatch();

  useQuery({
    queryKey: ["refresh"],
    queryFn: async () => {
      const response = await refreshToken();
      console.log("Token refreshed:", response.data);
      dispatch(login(response.data));
      return response.data;
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
  });

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<h1>Hello Vite + React!</h1>} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
export default App;
