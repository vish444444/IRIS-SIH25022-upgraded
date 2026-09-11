/**
 * Seed script to create an initial admin user
 * Run: npx ts-node src/scripts/seedAdmin.ts
 */
import path from "path";
import { initializeDatabase } from "../db/database";
import userRepository from "../db/repositories/userRepository";

const seedAdmin = async () => {
  try {
    // Initialize database
    initializeDatabase();
    console.log("Database initialized");

    // Check if admin exists
    const existingAdmin = userRepository.findByEmail("admin@iris.com");
    if (existingAdmin) {
      console.log("Admin user already exists:");
      console.log("Email:", existingAdmin.email);
      console.log("Status:", existingAdmin.status);
      return;
    }

    // Create admin user
    const password = "Admin123!";
    const hashedPassword = await userRepository.hashPassword(password);

    const admin = userRepository.create({
      email: "admin@iris.com",
      name: "System Administrator",
      firstName: "System",
      lastName: "Administrator",
      role: "system_admin",
      status: "active",
      force_password_change: false,
      hashed_password: hashedPassword,
    });

    console.log("\n✅ Admin user created successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Email:    admin@iris.com");
    console.log("Password: Admin123!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\nYou can now login at /login\n");

  } catch (error) {
    console.error("Error seeding admin:", error);
    process.exit(1);
  }
};

seedAdmin();
