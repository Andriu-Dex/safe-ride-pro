import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';

import { PasswordHasher } from '../../application/ports/password-hasher';

@Injectable()
export class BcryptPasswordHasherService implements PasswordHasher {
  async hash(value: string): Promise<string> {
    return hash(value, 10);
  }

  async compare(value: string, passwordHash: string): Promise<boolean> {
    return compare(value, passwordHash);
  }
}
