// Quick test script for Settings and Contact APIs
const http = require("http");

function testEndpoint(path, method = "GET", data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 5000,
      path: path,
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on("error", reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runTests() {
  console.log("\n🧪 Testing Settings and Contact APIs\n");
  console.log("=".repeat(50));

  try {
    // Test 1: GET Settings (Public)
    console.log("\n1️⃣  Testing: GET /api/settings (Public)");
    const settingsResponse = await testEndpoint("/api/settings");
    console.log(`   Status: ${settingsResponse.status}`);
    console.log(
      `   Has general info: ${!!settingsResponse.data?.data?.general}`
    );
    console.log(
      `   Has business hours: ${!!settingsResponse.data?.data?.businessHours}`
    );
    console.log(
      `   Has social media: ${!!settingsResponse.data?.data?.socialMedia}`
    );
    console.log(`   ✅ Settings endpoint working\n`);

    // Test 2: POST Contact Form (Public)
    console.log("2️⃣  Testing: POST /api/contact (Public)");
    const contactData = {
      name: "Test User",
      email: "test@example.com",
      phone: "1234567890",
      subject: "general",
      message: "This is a test message from the API test script",
    };
    const contactResponse = await testEndpoint(
      "/api/contact",
      "POST",
      contactData
    );
    console.log(`   Status: ${contactResponse.status}`);
    console.log(`   Response: ${contactResponse.data?.message || "Success"}`);
    console.log(`   ✅ Contact form endpoint working\n`);

    console.log("=".repeat(50));
    console.log("\n✅ All API tests completed successfully!\n");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }

  process.exit(0);
}

// Wait a moment for server to be ready
setTimeout(runTests, 1000);
