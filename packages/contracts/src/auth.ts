import { z } from 'zod';
import { idSchema, roleSchema } from './common';

export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
export type LoginRequest = z.input<typeof loginRequestSchema>;

export const userSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.email(),
  role: roleSchema,
});
export type User = z.infer<typeof userSchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  user: userSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;
