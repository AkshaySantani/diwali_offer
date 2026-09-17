import crypto from 'crypto';

export function normalizePhoneNumber(input: string): string {
  // Remove all non-numeric characters
  const digits = input.replace(/\D/g, '');
  // If starts with 91 and has 12 digits, strip country code to get 10-digit mobile
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  // If has leading 0 and 11 digits, strip 0
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

export function isValidIndianPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // Standard Indian mobile number: 10 digits starting with 6, 7, 8, or 9
  return /^[6-9]\d{9}$/.test(normalized);
}

export function generateRewardCode(): string {
  // Generate a clean, human-readable 6-character alphanumeric code
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // exclude confusing chars like 0, 1, I, O
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `AF-${code}`;
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 10) return phone;
  return `${phone.slice(0, 2)}******${phone.slice(-2)}`;
}
