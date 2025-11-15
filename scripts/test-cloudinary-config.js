require("dotenv").config();
const cloudinary = require("cloudinary").v2;

console.log("🧪 Testing Cloudinary Configuration...\n");

// Configure
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Display config (masked)
console.log("📋 Current Configuration:");
console.log(
  "   CLOUDINARY_CLOUD_NAME:",
  process.env.CLOUDINARY_CLOUD_NAME || "❌ NOT SET"
);
console.log(
  "   CLOUDINARY_API_KEY:",
  process.env.CLOUDINARY_API_KEY
    ? process.env.CLOUDINARY_API_KEY.substring(0, 5) + "..."
    : "❌ NOT SET"
);
console.log(
  "   CLOUDINARY_API_SECRET:",
  process.env.CLOUDINARY_API_SECRET
    ? "***" + process.env.CLOUDINARY_API_SECRET.slice(-4)
    : "❌ NOT SET"
);

// Test API connection
async function testConnection() {
  try {
    console.log("\n🔄 Testing API connection...");
    const result = await cloudinary.api.ping();
    console.log("✅ Connection successful!", result);
    console.log("\n🎉 Your Cloudinary credentials are working!");
  } catch (error) {
    console.error("\n❌ Connection failed!");
    console.error("Error:", error.message);

    if (error.message.includes("Invalid")) {
      console.error("\n💡 Solution: Check that your credentials are correct:");
      console.error("   1. Go to https://cloudinary.com/console");
      console.error("   2. Copy Cloud Name, API Key, and API Secret");
      console.error("   3. Update your .env file");
      console.error("   4. Restart your server");
    }
  }
}

testConnection();
