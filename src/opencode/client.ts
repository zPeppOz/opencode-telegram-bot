import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import type {
  OcSession,
  OcMessage,
  OcProvidersResponse,
  OcConfig,
  OcSessionStatus,
} from "./types.js";

class OpenCodeClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor() {
    this.baseUrl = config.opencode.apiUrl;
    this.headers = { "Content-Type": "application/json" };
    if (config.opencode.password) {
      const encoded = Buffer.from(`opencode:${config.opencode.password}`).toString("base64");
      this.headers["Authorization"] = `Basic ${encoded}`;
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    logger.debug(`API ${init?.method ?? "GET"} ${path}`);
    const res = await fetch(url, {
      ...init,
      headers: { ...this.headers, ...init?.headers },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenCode API ${res.status}: ${path} - ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/session`, {
        headers: this.headers,
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // Sessions
  async listSessions(): Promise<OcSession[]> {
    return this.request<OcSession[]>("/session");
  }

  async getSession(sessionId: string): Promise<OcSession> {
    return this.request<OcSession>(`/session/${sessionId}`);
  }

  async createSession(directory?: string): Promise<OcSession> {
    return this.request<OcSession>("/session", {
      method: "POST",
      body: JSON.stringify(directory ? { directory } : {}),
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.request<unknown>(`/session/${sessionId}`, { method: "DELETE" });
  }

  async getSessionStatus(): Promise<OcSessionStatus> {
    return this.request<OcSessionStatus>("/session/status");
  }

  async abortSession(sessionId: string): Promise<boolean> {
    return this.request<boolean>(`/session/${sessionId}/abort`, { method: "POST" });
  }

  async forkSession(sessionId: string, messageId?: string): Promise<OcSession> {
    return this.request<OcSession>(`/session/${sessionId}/fork`, {
      method: "POST",
      body: JSON.stringify(messageId ? { messageID: messageId } : {}),
    });
  }

  async shareSession(sessionId: string): Promise<{ url: string }> {
    return this.request<{ url: string }>(`/session/${sessionId}/share`, {
      method: "POST",
    });
  }

  async summarizeSession(sessionId: string): Promise<void> {
    await this.request<unknown>(`/session/${sessionId}/summarize`, { method: "POST" });
  }

  // Messages
  async getMessages(sessionId: string): Promise<OcMessage[]> {
    return this.request<OcMessage[]>(`/session/${sessionId}/message`);
  }

  async sendMessage(
    sessionId: string,
    text: string,
    options?: { model?: { providerID: string; modelID: string }; agent?: string }
  ): Promise<OcMessage> {
    const body: Record<string, unknown> = {
      parts: [{ type: "text", text }],
    };
    if (options?.model) body["model"] = options.model;
    if (options?.agent) body["agent"] = options.agent;

    return this.request<OcMessage>(`/session/${sessionId}/message`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async sendMessageAsync(
    sessionId: string,
    text: string,
    options?: { model?: { providerID: string; modelID: string }; agent?: string }
  ): Promise<void> {
    const body: Record<string, unknown> = {
      parts: [{ type: "text", text }],
    };
    if (options?.model) body["model"] = options.model;
    if (options?.agent) body["agent"] = options.agent;

    await this.request<unknown>(`/session/${sessionId}/prompt_async`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async sendCommand(sessionId: string, command: string): Promise<void> {
    await this.request<unknown>(`/session/${sessionId}/command`, {
      method: "POST",
      body: JSON.stringify({ command }),
    });
  }

  async revertMessage(sessionId: string, messageId: string): Promise<void> {
    await this.request<unknown>(`/session/${sessionId}/revert`, {
      method: "POST",
      body: JSON.stringify({ messageID: messageId }),
    });
  }

  // Config & Providers
  async getConfig(): Promise<OcConfig> {
    return this.request<OcConfig>("/config");
  }

  async getProviders(): Promise<OcProvidersResponse> {
    return this.request<OcProvidersResponse>("/config/providers");
  }

  // Event stream URL (for SSE)
  get eventStreamUrl(): string {
    return `${this.baseUrl}/event`;
  }

  get authHeaders(): Record<string, string> {
    return { ...this.headers };
  }
}

export const opencode = new OpenCodeClient();
