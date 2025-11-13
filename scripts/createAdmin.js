require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/User");

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("📦 Connected to MongoDB");

    const adminEmail = "admin@southbrews.com";
    const adminPassword = "admin123";

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log("⚠️  Admin user already exists!");
      console.log("Email:", existingAdmin.email);
      console.log("Role:", existingAdmin.role);
      console.log("\n💡 Deleting and recreating...");

      // Delete existing admin
      await User.deleteOne({ email: adminEmail });
      console.log("🗑️  Deleted existing admin");
    }

    // Admin user data
    const adminData = {
      firstName: "Admin",
      lastName: "User",
      email: adminEmail,
      password: adminPassword, // ✅ Plain text - will be hashed by pre-save hook
      phone: "+1234567890",
      role: "admin",
      isActive: true,
      isEmailVerified: true,
    };

    // ❌ REMOVED: Manual hashing
    // const salt = await bcrypt.genSalt(10);
    // adminData.password = await bcrypt.hash(adminData.password, salt);

    // ✅ Create admin user - password will be hashed automatically
    const admin = await User.create(adminData);

    console.log("\n✅ Admin user created successfully!");
    console.log("📧 Email:", admin.email);
    console.log("🔑 Password:", adminPassword);
    console.log("👤 Role:", admin.role);
    console.log("🆔 ID:", admin._id);
    console.log("\n🎯 You can now login with these credentials");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin:", error);
    process.exit(1);
  }
};

createAdmin();
