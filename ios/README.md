# FirstGear for iOS

This Xcode project loads the FirstGear website in a WKWebView and provides a
native connection-error screen. It requires iOS 16 or later. It is not yet a
built or App Store-approved app.

## Set up sign-in

FirstGear uses single-use links sent by email. For a link opened from email to
sign the user into the app rather than Safari, configure Universal Links before
testing:

1. In Xcode, select the FirstGear target, choose your Apple Developer team under
   **Signing & Capabilities**, and confirm the bundle identifier is registered
   to your team. The project uses `com.firstgear.drivingschool` by default.
2. Enable Associated Domains for that App ID and keep
   `applinks:first-gear.store` in the app's entitlements.
3. Serve the following JSON over HTTPS without redirects at
   `https://first-gear.store/.well-known/apple-app-site-association`. Replace
   `TEAMID` with your actual Apple Developer Team ID and adjust the bundle ID
   if it differs from the one selected in Xcode. Use `application/json`.

   ```json
   {
     "applinks": {
       "details": [
         {
           "appIDs": ["TEAMID.com.firstgear.drivingschool"],
           "components": [{ "/": "/api/auth/verify" }]
         }
       ]
     }
   }
   ```

4. Deploy the site, install the signed app, and test a fresh sign-in link
   from an email app on a physical iPhone. The link must open FirstGear and
   complete sign-in inside it. If the association is missing or the link opens
   in Safari, Safari's session is separate from the app's web view.

## Build, install, and submit

1. On a Mac, open `FirstGear.xcodeproj` in a current version of Xcode.
2. Select your team in **Signing & Capabilities**, connect an iPhone, select
   it as the run destination, and run the app. Verify login, sign-out,
   bookings, external links, and the offline/retry experience on a device.
3. Create an App Store Connect app using the same bundle ID. Select
   **Any iOS Device**, then **Product > Archive** and use **Distribute App**
   to upload the archive. Complete the required App Store listing, privacy
   information, and review access instructions before submitting for review.

The app loads the deployed website, so website fixes must also be deployed.
The native fallback does not cache account information; it only provides
navigation placeholders and retry when the website cannot load. Cached website
behavior must be verified on an actual iPhone.

Apple reviews every submission. Its
[minimum functionality guideline](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality)
requires more than a repackaged website, so this initial web-based app may need
additional app-specific functionality before it can be approved.
