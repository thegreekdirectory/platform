# Privacy

The extension runs only on Google Maps and Yelp pages covered by manifest.json. It does not request or collect a user's name, email, Google account, Yelp account, search terms, browsing history, or location.

A random installation identifier is stored locally to apply request limits. Google Maps directory checks send Google Place IDs only. Yelp directory checks send the Yelp business slug only. Lookup results are held in Chrome session storage for up to three hours and clear when the browser session ends.

If a user submits a suggestion, the extension sends the platform business ID, business name, available address, relationship selection, and optional note for human review. No submitter name, email, phone, IP address, Google account, or Yelp account information is included in the suggestion record.

Google Maps and Yelp suggestion queues are separate. A suggestion is reviewed before it can be approved, and approval does not automatically create a public TGD listing. No analytics or advertising code is included. Local installation and submitted-ID data are removed when the extension is uninstalled or its data is cleared.
