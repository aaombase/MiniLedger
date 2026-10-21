import { formatPhoneForDisplay } from '@miniledger/shared';

/** How an OTP reaches the user. Production would implement this with an SMS provider. */
export interface OtpSender {
  send(phone: string, code: string, expiresAt: Date): Promise<void>;
}

interface Logger {
  info(message: string): void;
}

/**
 * ASSIGNMENT-ONLY: "delivers" the OTP by printing it in the server log, as the brief requires.
 * This is a demo shortcut, not authentication a real product could ship.
 */
export class ConsoleOtpSender implements OtpSender {
  constructor(private readonly logger: Logger) {}

  async send(phone: string, code: string, expiresAt: Date): Promise<void> {
    this.logger.info(
      `[MOCK OTP] ${formatPhoneForDisplay(phone)} -> ${code} (expires ${expiresAt.toISOString()}, dev only)`,
    );
  }
}
