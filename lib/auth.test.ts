// Mock the session retrieval to avoid real DB access
import { vi } from 'vitest';
vi.mock('@/lib/auth-session', async () => ({
  getAuthenticatedSession: vi.fn(),
}));

import { describe, it, expect, afterEach } from 'vitest';
import * as auth from '@/lib/auth';
import * as authSession from '@/lib/auth-session';
import { isReadOnlyDemoUser } from '@/lib/demo-protection';

// Helper to create a user shape matching AuthenticatedUser type
function makeUser({
  primaryRole = 'ALUMNI',
  secondaryRoles = [],
  isDemo = false,
  demoReadOnly = false,
}: {
  primaryRole?: string;
  secondaryRoles?: string[];
  isDemo?: boolean;
  demoReadOnly?: boolean;
}) {
  return {
    id: 'user_db_123',
    universityId: 'university_db_123',
    primaryRole,
    secondaryRoles: secondaryRoles.map((r) => ({ role: r })),
    isDemoAccount: isDemo,
    university: {
      kind: isDemo ? 'DEMO' : 'REAL',
      isReadOnlyDemo: demoReadOnly,
    },
  } as any;
}

describe('requireWritableUniversityRoles – production helper', () => {
  afterEach(() => {
    // Reset all mocks between tests
    vi.restoreAllMocks();
    // Reset the mocked implementation of getAuthenticatedSession
    // @ts-ignore – accessing mock on the imported function
    authSession.getAuthenticatedSession.mockReset();
  });

  it('rejects a read‑only DEMO account with DEMO_READ_ONLY code', async () => {
    const demoUser = makeUser({ isDemo: true, demoReadOnly: true });
    // @ts-ignore – typing of mocked function
    authSession.getAuthenticatedSession.mockResolvedValue({ user: demoUser });

    const request = new Request('http://localhost/api/opportunities');
    const result = await auth.requireWritableUniversityRoles(['ALUMNI'], 'msg', request);

    expect(result).toHaveProperty('response');
    const { response } = result as any;
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toMatchObject({ code: 'DEMO_READ_ONLY' });
  });

  it('allows a real university user (not demo) to pass', async () => {
    const realUser = makeUser({ isDemo: false });
    // @ts-ignore
    authSession.getAuthenticatedSession.mockResolvedValue({ user: realUser });

    const request = new Request('http://localhost/api/opportunities');
    const result = await auth.requireWritableUniversityRoles(['ALUMNI'], 'msg', request);

    expect(result).toHaveProperty('user');
    expect((result as any).user.id).toBe(realUser.id);
  });

  it('does not block a DEMO account that is not read‑only', async () => {
    const demoUser = makeUser({ isDemo: true, demoReadOnly: false });
    // @ts-ignore
    authSession.getAuthenticatedSession.mockResolvedValue({ user: demoUser });

    const request = new Request('http://localhost/api/opportunities');
    const result = await auth.requireWritableUniversityRoles(['ALUMNI'], 'msg', request);

    expect(result).toHaveProperty('user');
    expect((result as any).user.id).toBe(demoUser.id);
  });

  it('rejects a user missing the required role', async () => {
    const realUser = makeUser({ isDemo: false, primaryRole: 'ALUMNI' });
    // @ts-ignore
    authSession.getAuthenticatedSession.mockResolvedValue({ user: realUser });

    const request = new Request('http://localhost/api/opportunities');
    const result = await auth.requireWritableUniversityRoles(['ADMINISTRATOR'], 'msg', request);

    expect(result).toHaveProperty('response');
    const { response } = result as any;
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toMatchObject({ success: false, message: 'msg' });
  });

  it('propagates missing/invalid session as 401', async () => {
    // @ts-ignore
    authSession.getAuthenticatedSession.mockResolvedValue({ failure: 'missing' });

    const request = new Request('http://localhost/api/opportunities');
    const result = await auth.requireWritableUniversityRoles(['ALUMNI'], 'msg', request);

    expect(result).toHaveProperty('response');
    const { response } = result as any;
    expect(response.status).toBe(401);
  });
});