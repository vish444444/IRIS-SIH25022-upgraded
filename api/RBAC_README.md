# IRIS RBAC Authentication System

## Overview

This document describes the Role-Based Access Control (RBAC) authentication system implemented for the IRIS platform. The system uses SQLite for data persistence, JWT for access tokens, and bcrypt for password hashing.

## Architecture Summary

```
[Frontend React App]
        |
        v
[Express API Server]
        |
        v
[SQLite Database] --> users, roles, refresh_tokens, audit_logs
```

## Database Schema

### Users Table
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID primary key |
| email | TEXT | Unique user email |
| name | TEXT | Display name |
| role | TEXT | Single role (system_admin, section_controller, signal_operator, loco_pilot) |
| roles | TEXT | JSON array for backward compatibility |
| status | TEXT | active, disabled, or pending |
| force_password_change | INTEGER | 1 if user must change password on login |
| hashed_password | TEXT | bcrypt hash of password |
| created_by | TEXT | ID of admin who created the user |
| last_login_at | TEXT | ISO timestamp of last login |

### Key Design Decisions

1. **Single Role Model**: Users have exactly one role. The `role` field is authoritative; the `roles` array exists only for backward compatibility.

2. **Server-Side Hashing Only**: Passwords are hashed exactly once on the server using bcrypt with cost 10. The client sends plaintext passwords over HTTPS.

3. **No Auto-Password Generation**: When creating users, admin must explicitly provide an initial password. This prevents accidental credential overwrites.

4. **Protected System Admin**: The admin@iris.com account cannot be created, deleted, or have its role changed through the API.

---

## Backend Files Modified

### api/src/db/database.ts
- Added `role` column to users table schema
- Added `VALID_ROLES` constant and `UserRole` type export
- Added `migrateToSingleRole()` function to backfill role from roles array
- Called migration on database initialization

### api/src/db/repositories/userRepository.ts
- Changed `User` interface to use single `role: UserRole` field
- Added `generateSecurePassword()` helper (unused but available)
- Updated CRUD operations to use single role
- Keeps `roles` JSON array in sync for backward compat

### api/src/controller/admin.controller.ts
- Removed auto-password generation logic
- Made `initial_password` required on user creation (returns 400 if missing)
- Made `new_password` required on password reset
- Added protection for system admin email (cannot create duplicate or modify role)
- Added protection to prevent disabling system admin
- Removed `generateTempPassword` endpoint

### api/src/controller/auth.controller.ts
- Updated to use single `role` field in JWT payload
- Added backward compat: response includes both `role` and `roles: [role]`
- Fixed token refresh to use correct field names from repository return type

### api/src/middleware/rbac.middleware.ts
- Updated `AuthenticatedRequest` interface to use single `role` field
- Changed `getRolePermissions()` to accept single role string
- Updated middleware to read role from token, with fallback to user.role

### api/src/utils/jwt.ts
- Updated `JWTPayload` interface to have `role: string` (primary) and optional `roles` array

### api/src/routes/admin.route.ts
- Removed `/users/:id/generate-temp-password` endpoint
- Kept `/users/:id/reset-password` (now requires admin to provide new_password)

### api/src/routes/auth.route.ts
- Fixed imports to use correct export names (`refreshToken` instead of `refresh`)
- Removed unused `signup`, `signin` aliases

### api/src/validators/admin.validator.ts
- Changed from `roles` array validation to single `role` string
- Made `initial_password` required with full password policy validation
- Made `new_password` required in reset password validator

### api/src/scripts/seedAdmin.ts
- Updated to use single `role: "system_admin"` instead of `roles` array

---

## Frontend Files Modified

### client/src/context/AuthContext.tsx
- Added `role: string` to `User` interface (alongside optional `roles` array)
- Added `getUserRole(user)` helper function to get the authoritative role
- Added `getLandingRouteForRole(role)` helper function for redirect logic
- Updated login to normalize user data and ensure role is set correctly
- Clears stale localStorage before storing new user data

### client/src/pages/Login.tsx
- Uses `getUserRole()` and `getLandingRouteForRole()` for post-login redirect
- Added debug console.log statements for troubleshooting (can be removed in production)
- Uses `navigate(path, { replace: true })` to avoid back-button issues

### client/src/pages/ChangePassword.tsx
- Updated to use `getUserRole()` and `getLandingRouteForRole()` helpers

### client/src/pages/AdminUsers.tsx
- Made `initial_password` a required field in Add User modal
- Removed auto-generate option (no blank password allowed)
- Credentials modal uses local form value (password not returned from server)
- Added Reset Password modal where admin explicitly enters new password
- Copy credentials copies the password admin just entered
- Role selection uses radio buttons (single role only)

### client/src/components/ProtectedRoute.tsx
- Updated to use `getUserRole()` and `getLandingRouteForRole()` helpers
- Improved role checking for protected routes

### client/src/components/layouts/LandingLayout.tsx
- Updated dashboard link to use role helpers

### client/src/components/ui/role-badge.tsx
- Updated styling: role-colored background with black text

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/auth/login | Authenticate user, returns JWT tokens |
| POST | /api/v1/auth/refresh | Refresh access token |
| POST | /api/v1/auth/logout | Invalidate refresh token |
| POST | /api/v1/auth/change-password | Change user's password |
| GET | /api/v1/auth/me | Get current user info |

### Admin User Management (requires system_admin role)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/admin/users | Create user (requires initial_password) |
| GET | /api/v1/admin/users | List users with pagination and filters |
| GET | /api/v1/admin/users/:id | Get single user |
| PATCH | /api/v1/admin/users/:id | Update user name, role |
| POST | /api/v1/admin/users/:id/reset-password | Reset password (requires new_password) |
| PATCH | /api/v1/admin/users/:id/status | Enable/disable user |
| GET | /api/v1/admin/users/:id/audit-logs | Get audit logs for user |

---

## Default Admin Credentials

```
Email: admin@iris.com
Password: Admin123!
```

These credentials are set in the database and will not be modified by any user creation or password reset flows.

---

## Role-Based Routing

| Role | Landing Page |
|------|--------------|
| system_admin | /admin/users |
| section_controller | /dashboard/controller |
| signal_operator | /dashboard/signals |
| loco_pilot | /dashboard/driver |

---

## Password Policy

Passwords must meet the following requirements:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (!@#$%^&*()_+-=[]{}etc)

---

## Security Considerations

1. Passwords are hashed with bcrypt (cost 10) server-side only
2. JWT access tokens expire in 15 minutes (configurable)
3. Refresh tokens are stored hashed in database
4. All password-related audit logs do not include plaintext passwords
5. System admin account is protected from modification
6. Disabled users cannot authenticate (refresh tokens revoked)

---

## Running the Application

### API Server
```bash
cd api
npm install
npm start
```

### Frontend Client
```bash
cd client
npm install
npm run dev
```

### Train Simulator
```bash
cd simulator
npm install
npm start
```

---

## Troubleshooting

### Admin login redirects to driver page
1. Clear browser localStorage: `localStorage.clear()`
2. Verify database has correct role: 
   ```bash
   sqlite3 api/src/data/iris.db "SELECT email, role FROM users WHERE email = 'admin@iris.com';"
   ```
3. If role is wrong, fix it:
   ```bash
   sqlite3 api/src/data/iris.db "UPDATE users SET role = 'system_admin' WHERE email = 'admin@iris.com';"
   ```

### Password not working after reset
1. Ensure password is hashed only once (server-side)
2. Check bcrypt cost matches (should be 10)
3. Verify hashed_password column was updated in database

### Cannot create user with admin email
This is intentional. The system admin email (admin@iris.com) is protected to prevent accidental overwrites.
