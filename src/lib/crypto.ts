import crypto from 'crypto';

// Utilizar a chave do ambiente ou derivar uma chave de 256 bits segura
const SECRET = process.env.ENCRYPTION_KEY || process.env.HOTMART_HOTTOK || 'canada-sem-filtro-crm-secret-key-2026-pgp';
const ALGORITHM = 'aes-256-gcm';

// Derivar uma chave exata de 32 bytes usando SHA-256
const KEY = crypto.createHash('sha256').update(SECRET).digest();

/**
 * Criptografa uma string sensível (ex: CPF, Logradouro, Número, Complemento)
 * utilizando o padrão AES-256-GCM.
 */
export function encryptSensitive(text: string | null | undefined): string | null {
  if (!text || text.trim() === '' || text === 'Não informado') {
    return text || null;
  }

  // Se já estiver criptografado, não criptografar novamente
  if (text.startsWith('enc:v1:')) {
    return text;
  }

  try {
    const iv = crypto.randomBytes(12); // IV de 12 bytes para GCM
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Formato: enc:v1:<iv_hex>:<auth_tag_hex>:<encrypted_hex>
    return `enc:v1:${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('Erro ao criptografar dado sensível:', err);
    return text;
  }
}

/**
 * Descriptografa um dado sensível criptografado no formato enc:v1:...
 * Se o dado for legada (texto puro), retorna o próprio texto (compatibilidade retroativa).
 */
export function decryptSensitive(ciphertext: string | null | undefined): string | null {
  if (!ciphertext || typeof ciphertext !== 'string') {
    return ciphertext || null;
  }

  if (!ciphertext.startsWith('enc:v1:')) {
    return ciphertext; // Retorna texto puro antigo sem quebrar
  }

  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 5) return ciphertext;

    const iv = Buffer.from(parts[2], 'hex');
    const authTag = Buffer.from(parts[3], 'hex');
    const encryptedText = parts[4];

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('Erro ao descriptografar dado sensível:', err);
    return '[Dado Criptografado Protegido]';
  }
}

/**
 * Criptografa os campos sensíveis de um objeto de cliente antes de gravar no Supabase
 */
export function encryptClientRecord<T extends Record<string, any>>(client: T): T {
  if (!client) return client;
  return {
    ...client,
    document: encryptSensitive(client.document),
    address: encryptSensitive(client.address),
    number: encryptSensitive(client.number),
    complement: encryptSensitive(client.complement),
  };
}

/**
 * Descriptografa os campos sensíveis de um objeto de cliente retornado do Supabase
 */
export function decryptClientRecord<T extends Record<string, any>>(client: T): T {
  if (!client) return client;
  return {
    ...client,
    document: decryptSensitive(client.document),
    address: decryptSensitive(client.address),
    number: decryptSensitive(client.number),
    complement: decryptSensitive(client.complement),
  };
}
