import { check } from "express-validator";

export const createUserValidator = [
  check("email").isEmail().withMessage("Must be a valid email address"),
  check("name").optional().not().isEmpty().withMessage("Name cannot be empty"),
  check("role")
    .notEmpty()
    .withMessage("Role is required")
    .isIn(["system_admin", "section_controller", "signal_operator", "loco_pilot"])
    .withMessage("Invalid role. Must be one of: system_admin, section_controller, signal_operator, loco_pilot"),
  check("initial_password")
    .notEmpty()
    .withMessage("Initial password is required")
    .isLength({ min: 8 })
    .withMessage("Initial password must be at least 8 characters long")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number")
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
    .withMessage("Password must contain at least one special character"),
];

export const updateUserValidator = [
  check("name").optional().not().isEmpty().withMessage("Name cannot be empty"),
  check("role")
    .optional()
    .isIn(["system_admin", "section_controller", "signal_operator", "loco_pilot"])
    .withMessage("Invalid role. Must be one of: system_admin, section_controller, signal_operator, loco_pilot"),
  check("status")
    .optional()
    .isIn(["active", "disabled", "pending"])
    .withMessage("Status must be one of: active, disabled, pending"),
];

export const resetPasswordValidator = [
  check("new_password")
    .notEmpty()
    .withMessage("New password is required")
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
