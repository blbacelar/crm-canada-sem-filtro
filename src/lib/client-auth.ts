export interface CurrentUser {
  id: string;
  email?: string | null;
  name?: string;
  surname?: string;
  avatarUrl?: string | null;
  role: string;
}

/**
 * The browser Supabase client may need one tick to persist the session cookie
 * after sign-in. Retry only 401 responses so the first protected request does
 * not permanently leave a page in an unauthenticated error state.
 */
export async function fetchCurrentUser(attempts = 4): Promise<CurrentUser | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      if (response.ok) return (await response.json()) as CurrentUser;
      if (response.status !== 401 || attempt === attempts - 1) return null;
    } catch {
      if (attempt === attempts - 1) return null;
    }

    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
  }

  return null;
}
