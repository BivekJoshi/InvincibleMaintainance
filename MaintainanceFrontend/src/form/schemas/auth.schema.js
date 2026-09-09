import { z } from 'zod';
import { email, password } from './fields';

export const loginSchema = z.object({ email, password });

export const loginDefaults = { email: '', password: '' };
