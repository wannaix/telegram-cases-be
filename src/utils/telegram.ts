import crypto from "crypto";
import { config } from "../config/index.js";
export interface TelegramWebAppData {
  user: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
  };
  auth_date: number;
  hash: string;
}
export function validateTelegramWebAppData(
  initData: string
): TelegramWebAppData | null {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    if (!hash) {
      return null;
    }
    urlParams.delete("hash");
    const dataCheckArray: string[] = [];
    for (const [key, value] of urlParams.entries()) {
      dataCheckArray.push(`${key}=${value}`);
    }
    dataCheckArray.sort();
    const dataCheckString = dataCheckArray.join("\n");
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(config.TELEGRAM_BOT_TOKEN)
      .digest();
    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");
    if (calculatedHash !== hash) {
      return null;
    }
    const userParam = urlParams.get("user");
    const authDateParam = urlParams.get("auth_date");
    if (!userParam || !authDateParam) {
      return null;
    }
    const user = JSON.parse(userParam);
    const authDate = parseInt(authDateParam);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      console.log('Data is too old (>24 hours)');
      return null;
    }
    console.log('Validation successful');
    return {
      user,
      auth_date: authDate,
      hash,
    };
  } catch (error) {
    return null;
  }
}
