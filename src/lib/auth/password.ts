import bcrypt from 'bcryptjs';
import { getEnv } from '../env/index.js';

//password strength requirements
export const PASSWORD_REQUIREMENTS = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBERS: true,
  REQUIRE_SYMBOLS: false, //optional for better UX
  MIN_ENTROPY: 30, //minimum entropy score
} as const;

//common weak passwords to check against
const COMMON_WEAK_PASSWORDS = new Set([
  'password', '123456', '123456789', 'qwerty', 'abc123',
  'password123', 'admin', 'letmein', 'welcome', 'monkey',
  '1234567890', 'dragon', 'master', 'shadow', 'superman',
]);

//password validation result
export interface PasswordValidationResult {
  isValid: boolean;
  score: number; //0-100 strength score
  feedback: string[];
  entropy: number;
}

//hashes password using bcrypt with configured rounds
export async function hashPassword(password: string): Promise<string> {
  const env = getEnv();
  const saltRounds = env.BCRYPT_ROUNDS;
  
  //validate input
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  
  if (password.length < PASSWORD_REQUIREMENTS.MIN_LENGTH) {
    throw new Error(`Password must be at least ${PASSWORD_REQUIREMENTS.MIN_LENGTH} characters`);
  }
  
  if (password.length > PASSWORD_REQUIREMENTS.MAX_LENGTH) {
    throw new Error(`Password must not exceed ${PASSWORD_REQUIREMENTS.MAX_LENGTH} characters`);
  }

  try {
    return await bcrypt.hash(password, saltRounds);
  } catch (error) {
    throw new Error('Failed to hash password');
  }
}

//verifies password against hash
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash || typeof password !== 'string' || typeof hash !== 'string') {
    return false;
  }

  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    //log error in production but don't expose details
    console.error('Password verification error:', error);
    return false;
  }
}

//calculates password entropy
function calculateEntropy(password: string): number {
  if (!password) return 0;
  
  let charsetSize = 0;
  
  //check character sets used
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/[0-9]/.test(password)) charsetSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32; //symbols
  
  //entropy = log2(charset^length)
  return password.length * Math.log2(charsetSize);
}

//calculates password strength score (0-100)
function calculateStrengthScore(password: string): number {
  let score = 0;
  
  //length bonus
  score += Math.min(password.length * 2, 25);
  
  //character variety bonus
  if (/[a-z]/.test(password)) score += 5;
  if (/[A-Z]/.test(password)) score += 5;
  if (/[0-9]/.test(password)) score += 5;
  if (/[^a-zA-Z0-9]/.test(password)) score += 10;
  
  //pattern penalties
  if (/(.)\1{2,}/.test(password)) score -= 10; //repeated characters
  if (/012|123|234|345|456|567|678|789|890/.test(password)) score -= 10; //sequences
  if (/abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(password)) score -= 10;
  
  //entropy bonus
  const entropy = calculateEntropy(password);
  score += Math.min(entropy / 2, 25);
  
  //common password penalty
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    score = Math.min(score, 20);
  }
  
  return Math.max(0, Math.min(100, score));
}

//validates password strength and requirements
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const feedback: string[] = [];
  let isValid = true;
  
  //basic validation
  if (!password) {
    return {
      isValid: false,
      score: 0,
      feedback: ['Password is required'],
      entropy: 0,
    };
  }
  
  //length check
  if (password.length < PASSWORD_REQUIREMENTS.MIN_LENGTH) {
    feedback.push(`Password must be at least ${PASSWORD_REQUIREMENTS.MIN_LENGTH} characters long`);
    isValid = false;
  }
  
  if (password.length > PASSWORD_REQUIREMENTS.MAX_LENGTH) {
    feedback.push(`Password must not exceed ${PASSWORD_REQUIREMENTS.MAX_LENGTH} characters`);
    isValid = false;
  }
  
  //character requirements
  if (PASSWORD_REQUIREMENTS.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    feedback.push('Password must contain at least one uppercase letter');
    isValid = false;
  }
  
  if (PASSWORD_REQUIREMENTS.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    feedback.push('Password must contain at least one lowercase letter');
    isValid = false;
  }
  
  if (PASSWORD_REQUIREMENTS.REQUIRE_NUMBERS && !/[0-9]/.test(password)) {
    feedback.push('Password must contain at least one number');
    isValid = false;
  }
  
  if (PASSWORD_REQUIREMENTS.REQUIRE_SYMBOLS && !/[^a-zA-Z0-9]/.test(password)) {
    feedback.push('Password must contain at least one symbol');
    isValid = false;
  }
  
  //calculate metrics
  const entropy = calculateEntropy(password);
  const score = calculateStrengthScore(password);
  
  //entropy check
  if (entropy < PASSWORD_REQUIREMENTS.MIN_ENTROPY) {
    feedback.push('Password is too predictable, use more varied characters');
    isValid = false;
  }
  
  //common password check
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    feedback.push('Password is too common, choose something more unique');
    isValid = false;
  }
  
  //pattern checks
  if (/(.)\1{2,}/.test(password)) {
    feedback.push('Avoid repeated characters');
  }
  
  if (/012|123|234|345|456|567|678|789|890/.test(password)) {
    feedback.push('Avoid sequential numbers');
  }
  
  //strength feedback
  if (score < 30) {
    feedback.push('Password is very weak');
  } else if (score < 50) {
    feedback.push('Password is weak');
  } else if (score < 70) {
    feedback.push('Password is fair');
  } else if (score < 90) {
    feedback.push('Password is strong');
  }
  
  return {
    isValid,
    score,
    feedback,
    entropy,
  };
}

//generates a secure random password
export function generateSecurePassword(length: number = 16): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  //ensure minimum requirements are met
  let charset = lowercase + uppercase + numbers;
  if (PASSWORD_REQUIREMENTS.REQUIRE_SYMBOLS) {
    charset += symbols;
  }
  
  let password = '';
  
  //ensure at least one character from each required set
  if (PASSWORD_REQUIREMENTS.REQUIRE_LOWERCASE) {
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
  }
  if (PASSWORD_REQUIREMENTS.REQUIRE_UPPERCASE) {
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
  }
  if (PASSWORD_REQUIREMENTS.REQUIRE_NUMBERS) {
    password += numbers[Math.floor(Math.random() * numbers.length)];
  }
  if (PASSWORD_REQUIREMENTS.REQUIRE_SYMBOLS) {
    password += symbols[Math.floor(Math.random() * symbols.length)];
  }
  
  //fill remaining length with random characters
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  //shuffle the password to avoid predictable patterns
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

//checks if password needs to be rehashed (due to cost factor changes)
export function needsRehash(hash: string): boolean {
  const env = getEnv();
  const currentRounds = env.BCRYPT_ROUNDS;
  
  try {
    //extract rounds from existing hash
    const rounds = parseInt(hash.split('$')[2]);
    return rounds < currentRounds;
  } catch {
    //if we can't parse the hash, assume it needs rehashing
    return true;
  }
}

//rehashes password if needed
export async function rehashPasswordIfNeeded(password: string, currentHash: string): Promise<string | null> {
  if (!needsRehash(currentHash)) {
    return null;
  }
  
  //verify password first
  const isValid = await verifyPassword(password, currentHash);
  if (!isValid) {
    throw new Error('Invalid password for rehashing');
  }
  
  return await hashPassword(password);
}

//timing-safe password comparison to prevent timing attacks
export async function timingSafeVerifyPassword(password: string, hash: string): Promise<boolean> {
  //always perform a hash operation to maintain consistent timing
  const dummyHash = '$2b$12$dummyhashtopreventtimingattacks12345678901234567890';
  
  if (!password || !hash) {
    //perform dummy operation with consistent timing
    await bcrypt.compare('dummy', dummyHash);
    return false;
  }
  
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    //perform dummy operation on error to maintain timing
    await bcrypt.compare('dummy', dummyHash);
    return false;
  }
}