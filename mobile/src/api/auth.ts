import type {StoredSession} from '../auth/tokenStore';
import {request} from './client';

interface LoginResponseBody {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    username: string;
    full_name: string;
    phone: string | null;
    region: string | null;
    role: string;
    is_active: boolean;
  };
}

/**
 * The design labels this field "Tài khoản"; the backend accepts either the
 * username or the email address in it, so a farmer can use whichever they
 * remember.
 */
export async function login(identifier: string, password: string): Promise<StoredSession> {
  const body = await request<LoginResponseBody>('/auth/login', {
    method: 'POST',
    body: {username: identifier.trim(), password},
  });

  return {
    token: body.access_token,
    user: {
      id: body.user.id,
      username: body.user.username,
      fullName: body.user.full_name,
      role: body.user.role,
      phone: body.user.phone,
      region: body.user.region,
    },
  };
}

export async function fetchMe(token: string): Promise<StoredSession['user']> {
  const body = await request<LoginResponseBody['user']>('/auth/me', {token});
  return {
    id: body.id,
    username: body.username,
    fullName: body.full_name,
    role: body.role,
    phone: body.phone,
    region: body.region,
  };
}
