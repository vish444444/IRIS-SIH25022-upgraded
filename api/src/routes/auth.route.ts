import { Router } from "express";
const router = Router();

import { check } from "express-validator";
import { runValidation } from "../validators/index.validator";
import { authenticate } from "../middleware/rbac.middleware";
import { login, refreshToken, changePassword, logout, me } from "../controller/auth.controller";

// Validators
const loginValidator = [
  check("email").isEmail().withMessage("Must be a valid email address"),
  check("password").notEmpty().withMessage("Password is required"),
];

const changePasswordValidator = [
  check("new_password")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters long")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number")
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
    .withMessage("Password must contain at least one special character"),
];

const refreshValidator = [
  check("refresh_token").notEmpty().withMessage("Refresh token is required"),
];

// Public routes
router.post("/login", loginValidator, runValidation, login);
router.post("/refresh", refreshValidator, runValidation, refreshToken);

// Legacy routes for backward compatibility (alias to login)
router.post("/signin", loginValidator, runValidation, login);

// Authenticated routes
router.post("/change-password", authenticate, changePasswordValidator, runValidation, changePassword);
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, me);

export default router;
