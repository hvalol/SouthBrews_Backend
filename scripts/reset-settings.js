// Script to reset/fix Settings document
const mongoose = require("mongoose");
require("dotenv").config();

const Settings = require("../src/models/Settings");

async function resetSettings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Delete any existing settings documents
    const deleteResult = await Settings.deleteMany({});
    console.log(
      `🗑️  Deleted ${deleteResult.deletedCount} existing settings documents`
    );

    // Create new settings with proper defaults
    const settings = await Settings.getSingleton();
    console.log("✅ Created new settings document with defaults:");
    console.log(JSON.stringify(settings.general, null, 2));

    mongoose.disconnect();
    console.log("\n✅ Settings reset complete!");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

resetSettings();
