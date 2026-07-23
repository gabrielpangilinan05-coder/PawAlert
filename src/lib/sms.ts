import { toPhIntl } from "@/lib/phone";

export type SmsSendResult = { ok: true; mode: "dev" | "semaphore" } | { ok: false; error: string };

function smsDevMode(): boolean {
  return process.env.SMS_DEV_MODE !== "false";
}

/** Send SMS via Semaphore when configured; otherwise log for local/dev. */
export async function sendSms(phone09: string, message: string): Promise<SmsSendResult> {
  const apiKey = process.env.SEMAPHORE_API_KEY?.trim();
  const sender = process.env.SEMAPHORE_SENDER?.trim() || "PawAlert";

  if (!apiKey || smsDevMode()) {
    console.info(`[sms:dev] to=${phone09} message=${message}`);
    return { ok: true, mode: "dev" };
  }

  try {
    const body = new URLSearchParams({
      apikey: apiKey,
      number: toPhIntl(phone09),
      message,
      sendername: sender,
    });
    const res = await fetch("https://api.semaphore.co/api/v4/messages", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[sms:semaphore]", res.status, text);
      return { ok: false, error: "Could not send SMS. Try again." };
    }
    return { ok: true, mode: "semaphore" };
  } catch (err) {
    console.error("[sms:semaphore]", err);
    return { ok: false, error: "Could not send SMS. Try again." };
  }
}
