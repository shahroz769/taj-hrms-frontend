import express from "express";
import { register, login, logout, refresh } from "../controllers/authController.js";

const router = express.Router();

// @route         POST api/auth/register
// @description   Register new user
// @access        Public
router.post("/register", register);

// @route         POST api/auth/login
// @description   Authenticate user
// @access        Public
router.post("/login", login);

// @route         POST api/auth/logout
// @description   Logout user and clear refresh token
// @access        Private
router.post("/logout", logout);

// @route         POST api/auth/refresh
// @description   Generate new access token from refresh token
// @access        Public (Needs valid refresh token in cookie)
router.post("/refresh", refresh);

export default router;
