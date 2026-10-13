import {
  loginResponseSchema,
  userSchema,
  type LoginRequest,
} from '@courtly/contracts';
import { apiRequest } from './client';

export function login(body: LoginRequest) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body,
    schema: loginResponseSchema,
    auth: false,
  });
}

export function fetchMe() {
  return apiRequest('/auth/me', { schema: userSchema });
}
