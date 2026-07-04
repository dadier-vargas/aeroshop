const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const AppleStrategy = require('passport-apple');
const OAuthUserService = require('../services/oauthUserService');
const OAuthService = require('../services/oauthService');
const { getOAuthBaseUrl, getOAuthRedirectUris } = require('./oauthUrls');

function getOAuthCallbackBaseUrl() {
  return getOAuthBaseUrl();
}

function getApplePrivateKey() {
  const raw = (process.env.APPLE_PRIVATE_KEY || '').trim();
  if (!raw) return '';
  return raw.replace(/\\n/g, '\n');
}

function configurePassport() {
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user, done) => {
    done(null, user);
  });

  if (OAuthService.isGooglePassportConfigured()) {
    passport.use(
      'google',
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID.trim(),
          clientSecret: process.env.GOOGLE_CLIENT_SECRET.trim(),
          callbackURL: getOAuthRedirectUris().google,
          scope: ['profile', 'email']
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const oauthProfile = OAuthService.buildGooglePassportProfile(profile);
            const result = await OAuthUserService.findOrCreateFromProfile(oauthProfile);
            done(null, { ...result, provider: 'google' });
          } catch (error) {
            done(error);
          }
        }
      )
    );
  }

  if (OAuthService.isApplePassportConfigured()) {
    passport.use(
      'apple',
      new AppleStrategy(
        {
          clientID: process.env.APPLE_CLIENT_ID.trim(),
          teamID: process.env.APPLE_TEAM_ID.trim(),
          keyID: process.env.APPLE_KEY_ID.trim(),
          privateKeyString: getApplePrivateKey(),
          callbackURL: getOAuthRedirectUris().apple,
          passReqToCallback: true,
          scope: ['name', 'email']
        },
        async (_req, _accessToken, _refreshToken, idToken, profile, done) => {
          try {
            const oauthProfile = OAuthService.buildApplePassportProfile(idToken, profile);
            const result = await OAuthUserService.findOrCreateFromProfile(oauthProfile);
            done(null, { ...result, provider: 'apple' });
          } catch (error) {
            done(error);
          }
        }
      )
    );
  }
}

module.exports = {
  configurePassport,
  getOAuthCallbackBaseUrl
};