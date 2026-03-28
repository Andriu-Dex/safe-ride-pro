import { apiRequest } from '../../../lib/api-client';
import type {
  CreateRatingInput,
  RatingList,
  RatingRecord,
} from '../types/rating';

type RatingMutationResponse = {
  message: string;
  rating: RatingRecord;
};

export async function listMyRatings(accessToken: string): Promise<RatingList> {
  return apiRequest<RatingList>('/ratings/me', {
    accessToken,
  });
}

export async function createRating(
  accessToken: string,
  input: CreateRatingInput,
): Promise<RatingMutationResponse> {
  return apiRequest<RatingMutationResponse>('/ratings', {
    method: 'POST',
    accessToken,
    body: input,
  });
}
