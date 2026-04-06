import { Resend } from "resend";
import type { AlertConfig } from "@tokenlens/shared";
import type { AlertDispatcher } from "./contracts.js";

export class MultiChannelAlertDispatcher implements AlertDispatcher {
  private readonly resend?: Resend;

  constructor(resendApiKey?: string) {
    this.resend = resendApiKey ? new Resend(resendApiKey) : undefined;
  }

  async dispatch(configs: AlertConfig[], payload: Record<string, unknown>): Promise<void> {
    await Promise.allSettled(configs.filter((config) => config.enabled).map((config) => this.dispatchOne(config, payload)));
  }

  private async dispatchOne(config: AlertConfig, payload: Record<string, unknown>): Promise<void> {
    if (config.channel === "email" && this.resend) {
      await this.resend.emails.send({
        from: "TokenLens <alerts@tokenlens.local>",
        to: [config.webhookUrl],
        subject: `TokenLens alert: ${String(payload.type ?? "event")}`,
        text: JSON.stringify(payload, null, 2),
      });
      return;
    }

    const body = config.channel === "pagerduty"
      ? {
          routing_key: config.webhookUrl,
          event_action: "trigger",
          payload: {
            summary: String(payload.summary ?? "TokenLens alert"),
            source: "tokenlens-worker",
            severity: payload.severity ?? "warning",
            custom_details: payload,
          },
        }
      : payload;

    const url = config.channel === "pagerduty"
      ? "https://events.pagerduty.com/v2/enqueue"
      : config.webhookUrl;

    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }
}