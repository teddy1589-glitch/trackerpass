import { getAmoTokens, upsertAmoTokens } from "@/lib/db";

interface AmoTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
}

interface AmoAccountResponse {
  id: number;
  name: string;
  subdomain: string;
  country?: string;
  currency?: string;
  current_user_id?: number;
  _embedded?: {
    users?: Array<{
      id: number;
      name: string;
      email?: string;
      lang?: string;
    }>;
  };
}

interface AmoLead {
  id: number;
  name: string;
  status_id: number;
  responsible_user_id: number;
  custom_fields_values?: Array<{
    field_id: number;
    field_name: string;
    values: Array<{ value: string | number }>;
  }>;
}

interface AmoContact {
  id: number;
  name: string;
  custom_fields_values?: Array<{
    field_id: number;
    field_name: string;
    values: Array<{ value: string | number }>;
  }>;
}

export class AmoCRMClient {
  private subdomain: string;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokensLoaded = false;

  constructor() {
    this.subdomain = process.env.AMOCRM_SUBDOMAIN || "";
    this.clientId = process.env.AMOCRM_CLIENT_ID || "";
    this.clientSecret = process.env.AMOCRM_CLIENT_SECRET || "";
    this.redirectUri = process.env.AMOCRM_REDIRECT_URI || "";

    if (!this.subdomain || !this.clientId || !this.clientSecret) {
      throw new Error("AmoCRM credentials are not configured");
    }
  }

  private getBaseUrl(): string {
    return `https://${this.subdomain}.amocrm.ru`;
  }

  private getAuthCode(): string {
    return process.env.AMOCRM_AUTHORIZATION_CODE || "";
  }

  private async loadTokensFromDb(): Promise<void> {
    if (this.tokensLoaded) {
      return;
    }
    const tokens = await getAmoTokens();
    if (tokens) {
      this.accessToken = tokens.access_token;
      this.refreshToken = tokens.refresh_token;
    }
    this.tokensLoaded = true;
  }

  private async saveTokensToDb(tokens: AmoTokenResponse): Promise<void> {
    await upsertAmoTokens({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in ?? null,
    });
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token;
  }

  private async ensureTokens(): Promise<void> {
    await this.loadTokensFromDb();
    if (this.accessToken) {
      return;
    }
    const authCode = this.getAuthCode();
    if (authCode) {
      const tokens = await this.exchangeCodeForTokens(authCode);
      await this.saveTokensToDb(tokens);
      return;
    }
    throw new Error(
      "AmoCRM tokens not found. Set AMOCRM_AUTHORIZATION_CODE or insert tokens into rte.amocrm_tokens.",
    );
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    await this.ensureTokens();

    const url = `${this.getBaseUrl()}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (response.status === 401) {
      await this.handleUnauthorized();
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!retryResponse.ok) {
        const retryText = await retryResponse.text();
        throw new Error(
          `AmoCRM API error: ${retryResponse.status} ${retryResponse.statusText}. ${retryText}`,
        );
      }

      return this.parseJsonResponse<T>(retryResponse);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `AmoCRM API error: ${response.status} ${response.statusText}. ${errorText}`,
      );
    }

    return this.parseJsonResponse<T>(response);
  }

  private async parseJsonResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    if (!text) {
      return {} as T;
    }
    const isJson =
      contentType.includes("application/json") ||
      contentType.includes("application/hal+json") ||
      contentType.endsWith("+json");

    if (isJson) {
      return JSON.parse(text) as T;
    }
    throw new Error(`Unexpected response content-type: ${contentType}`);
  }

  private async handleUnauthorized(): Promise<void> {
    if (this.refreshToken) {
      const refreshed = await this.refreshAccessToken();
      await this.saveTokensToDb(refreshed);
      return;
    }

    const authCode = this.getAuthCode();
    if (authCode) {
      const tokens = await this.exchangeCodeForTokens(authCode);
      await this.saveTokensToDb(tokens);
      return;
    }

    throw new Error(
      "Token expired and no refresh token or authorization code is available",
    );
  }

  async refreshAccessToken(): Promise<AmoTokenResponse> {
    if (!this.refreshToken) {
      throw new Error("AMOCRM_REFRESH_TOKEN is not set");
    }

    const url = `${this.getBaseUrl()}/oauth2/access_token`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to refresh AmoCRM token: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as AmoTokenResponse;
  }

  async exchangeCodeForTokens(
    authorizationCode: string,
  ): Promise<AmoTokenResponse> {
    if (!authorizationCode) {
      throw new Error("Authorization code is required");
    }

    const url = `${this.getBaseUrl()}/oauth2/access_token`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "authorization_code",
        code: authorizationCode,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to exchange authorization code: ${response.status} ${response.statusText}. ${errorText}`,
      );
    }

    return (await response.json()) as AmoTokenResponse;
  }

  async getAccount(): Promise<
    | {
        id: number;
        name: string;
        subdomain: string;
        country?: string;
        currency?: string;
        current_user_id?: number;
        users: Array<{ id: number; name: string; email?: string }>;
      }
    | null
  > {
    const response = await this.request<AmoAccountResponse>("/api/v4/account");

    if (!response?.id) {
      return null;
    }

    return {
      id: response.id,
      name: response.name,
      subdomain: response.subdomain,
      country: response.country,
      currency: response.currency,
      current_user_id: response.current_user_id,
      users:
        response._embedded?.users?.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
        })) ?? [],
    };
  }

  async getLead(leadId: number): Promise<AmoLead | null> {
    try {
      const response = await this.request<AmoLead>(`/api/v4/leads/${leadId}`);
      return response.id ? response : null;
    } catch (error) {
      console.error(`Error fetching lead ${leadId}:`, error);
      return null;
    }
  }

  async getContact(contactId: number): Promise<AmoContact | null> {
    try {
      const response = await this.request<AmoContact>(
        `/api/v4/contacts/${contactId}`,
      );
      return response.id ? response : null;
    } catch (error) {
      console.error(`Error fetching contact ${contactId}:`, error);
      return null;
    }
  }

  async getUser(userId: number): Promise<{ id: number; name: string } | null> {
    try {
      const response = await this.request<{ id: number; name: string }>(
        `/api/v4/users/${userId}`,
      );
      return response.id ? response : null;
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);
      return null;
    }
  }
}