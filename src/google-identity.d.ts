/// <reference types="vite/client" />

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenError {
  type: string;
  message?: string;
}

interface GoogleTokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

interface GoogleIdentityOAuth2 {
  initTokenClient(options: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: (response: GoogleTokenError) => void;
  }): GoogleTokenClient;
}

interface Window {
  google?: {
    accounts: {
      oauth2: GoogleIdentityOAuth2;
    };
  };
}

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
}
