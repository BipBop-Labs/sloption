export const authConfiguration = {
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.APP_URL,
  trustedOrigins: process.env.APP_URL ? [process.env.APP_URL] : [],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    autoSignIn: false,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: { "/sign-in/email": { window: 60, max: 10 } },
  },
  advanced: { ipAddress: { ipAddressHeaders: ["x-sloption-client-ip"] } },
};
