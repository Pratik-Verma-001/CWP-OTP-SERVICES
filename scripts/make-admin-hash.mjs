// Usage: node scripts/make-admin-hash.mjs "your new admin password"
// Prints ADMIN_PASSWORD_HASH (and a fresh ADMIN_SESSION_SECRET) for your env vars.
import { randomBytes, scryptSync } from "crypto";
const pw = process.argv[2];
if (!pw || pw.length < 10) { console.error('Usage: node scripts/make-admin-hash.mjs "password with 10+ characters"'); process.exit(1); }
const salt = randomBytes(16);
console.log("ADMIN_PASSWORD_HASH=" + ["scrypt", 16384, salt.toString("base64url"), scryptSync(pw, salt, 64, { N: 16384 }).toString("base64url")].join("."));
console.log("ADMIN_SESSION_SECRET=" + randomBytes(32).toString("hex"));
