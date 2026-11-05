import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { config } from "../config";

// AES-256-GCM. Formato: v1:iv:tag:dados (base64). MASTER_KEY = 32 bytes em base64.
const key = Buffer.from(config.masterKey, "base64");
if (key.length !== 32) throw new Error("MASTER_KEY deve ter 32 bytes (openssl rand -base64 32)");

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decrypt(payload: string) {
  const [v, iv, tag, data] = payload.split(":");
  if (v !== "v1") throw new Error("versão de chave desconhecida");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}
