import { describe, expect, it, vi } from 'vitest';

import { apiRequest } from '../../../lib/api-client';
import {
  liftOperationalSanction,
  listReviewableActiveSanctions,
} from './sanction-api';

vi.mock('../../../lib/api-client', () => ({
  apiRequest: vi.fn(),
}));

describe('sanction api client', () => {
  it('lists active sanctions filtered by user for the admin user panel', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      items: [
        {
          id: 'sanction-1',
          membershipUserFullName: 'Usuario Uno',
        },
      ],
    });

    const response = await listReviewableActiveSanctions('access-token', {
      userId: 'user-1',
      limit: 100,
    });

    expect(response).toEqual([
      {
        id: 'sanction-1',
        membershipUserFullName: 'Usuario Uno',
      },
    ]);
    expect(apiRequest).toHaveBeenCalledWith('/sanctions/inbox', {
      accessToken: 'access-token',
      searchParams: {
        institutionId: undefined,
        userId: 'user-1',
        limit: '100',
      },
    });
  });

  it('sends the manual lift request with an administrative note', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      message: 'Sancion levantada manualmente correctamente.',
      sanction: {
        id: 'sanction-1',
      },
    });

    const response = await liftOperationalSanction('access-token', 'sanction-1', {
      reviewNote: 'Levantado desde panel de usuarios',
    });

    expect(response.message).toBe('Sancion levantada manualmente correctamente.');
    expect(apiRequest).toHaveBeenCalledWith('/sanctions/sanction-1/lift', {
      method: 'PATCH',
      accessToken: 'access-token',
      body: {
        reviewNote: 'Levantado desde panel de usuarios',
      },
    });
  });
});
