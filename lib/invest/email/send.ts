import { Resend } from 'resend'
import type { ReactElement } from 'react'

const DEFAULT_FROM = 'Finance OS <onboarding@resend.dev>'

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.ALERT_EMAIL_TO)
}

/** Sends via Resend. Returns false (without throwing) when not configured. */
export async function sendEmail(subject: string, react: ReactElement): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.ALERT_EMAIL_TO
  if (!apiKey || !to) return false

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: process.env.ALERT_EMAIL_FROM ?? DEFAULT_FROM,
    to,
    subject,
    react,
  })
  if (error) {
    throw new Error(`Resend: ${error.message}`)
  }
  return true
}
