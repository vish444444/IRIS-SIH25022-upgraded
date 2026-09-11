process.env.SQLITE_PATH = require("path").join(__dirname, "src", "data", "test_iris.db");
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test_refresh_secret";
