import { z } from "zod";
export const PASSWORD_HINT = "A senha precisa ter 8 ou mais caracteres, com letra, número e símbolo.";
export const passwordRule = z.string().max(128, PASSWORD_HINT)
  .refine((v) => v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v), PASSWORD_HINT);
