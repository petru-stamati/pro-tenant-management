export type RoleKey = "ADMIN" | "OWNER" | "TENANT";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: RoleKey;
  ownerId: string | null;
  tenantId: string | null;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
