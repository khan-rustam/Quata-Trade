import { createTransport } from "nodemailer";

/**
 * Narrow SMTP boundary — an interface so the service is unit-testable with a
 * mock transport. Production impl wraps nodemailer with env SMTP_* config.
 */

export const MAILER = Symbol("MAILER");

export interface Mailer {
  send(to: string, subject: string, text: string): Promise<void>;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export function createSmtpMailer(config: SmtpConfig): Mailer {
  const transport = createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user !== "" ? { user: config.user, pass: config.pass } : undefined,
  });
  return {
    async send(to: string, subject: string, text: string): Promise<void> {
      await transport.sendMail({ from: config.from, to, subject, text });
    },
  };
}
