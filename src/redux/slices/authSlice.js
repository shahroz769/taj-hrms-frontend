import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  isLogin: false,
  isAuthChecking: true,
  user: null,
  accessToken: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    login: (state, action) => {
      state.isLogin = true;
      state.isAuthChecking = false;
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
    },
    logout: (state) => {
      state.isLogin = false;
      state.isAuthChecking = false;
      state.user = null;
      state.accessToken = null;
    },
    setAuthChecking: (state, action) => {
      state.isAuthChecking = action.payload;
    },
  },
});

export const { login, logout, setAuthChecking } = authSlice.actions;
export default authSlice.reducer;