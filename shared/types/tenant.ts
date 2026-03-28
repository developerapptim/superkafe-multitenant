/**
 * @superkafe/shared - Tenant Types
 */

export interface Tenant {
  _id: string;
  name: string;
  slug: string;
  owner: string;
  isActive: boolean;
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  trialEndsAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type TenantSlug = string;
