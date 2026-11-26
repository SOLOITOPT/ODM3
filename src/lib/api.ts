export type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  created_at: string;
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type ProjectWithCount = Project & {
  mission_count: number;
};

export type ProjectInput = {
  name: string;
  description: string | null;
};

export type Vehicle = {
  id: string;
  model: string;
  registration_plate: string;
  created_at: string;
};

export type MissionOrderStatus = 'draft' | 'issued' | 'archived';

export type AuthorizedBy = 'operations' | 'administration' | null;

export type MissionOrder = {
  id: string;
  order_number: string;
  employee_id: string;
  vehicle_id: string;
  project_id: string | null;
  destination: string;
  start_date: string;
  end_date: string;
  status: MissionOrderStatus;
  authorized_by: AuthorizedBy;
  notes: string | null;
  created_at: string;
};

export type MissionOrderWithRelations = MissionOrder & {
  employee: Employee;
  vehicle: Vehicle;
  project: Project | null;
};

export type EmployeeInput = {
  first_name: string;
  last_name: string;
  position: string;
};

export type VehicleInput = {
  model: string;
  registration_plate: string;
};

export type MissionOrderInput = {
  employee_id: string;
  vehicle_id: string;
  project_id: string | null;
  destination: string;
  start_date: string;
  end_date: string;
  status?: MissionOrderStatus;
  authorized_by?: AuthorizedBy;
  notes?: string | null;
};

export type AuthStatusResponse = {
  needsSetup: boolean;
  envOverride: boolean;
  passwordSetAt: string | null;
};

export type AuthTokenResponse = {
  token: string;
  passwordSetAt: string | null;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

let inMemoryToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setApiAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

function apiUrl(endpoint: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${normalizedBase}api/${cleanEndpoint}`;
}

async function request<T>(
  endpoint: string,
  options: RequestInit & { skipAuthRedirect?: boolean } = {}
): Promise<T> {
  const { skipAuthRedirect, headers: customHeaders, ...rest } = options;
  const headers = new Headers(customHeaders);
  if (rest.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  const res = await fetch(apiUrl(endpoint), {
    ...rest,
    headers,
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && !skipAuthRedirect && unauthorizedHandler) {
      unauthorizedHandler();
    }
    const errObj = (data && typeof data === 'object' ? data : {}) as {
      error?: string;
      code?: string;
    };
    throw new ApiError(errObj.error || `Request failed (${res.status})`, res.status, errObj.code);
  }

  return data as T;
}

export const api = {
  auth: {
    status: () => request<AuthStatusResponse>('auth/status', { skipAuthRedirect: true }),
    setup: (password: string) =>
      request<AuthTokenResponse>('auth/setup', {
        method: 'POST',
        body: JSON.stringify({ password }),
        skipAuthRedirect: true,
      }),
    login: (username: string, password: string) =>
      request<AuthTokenResponse>('auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
        skipAuthRedirect: true,
      }),
    logout: () =>
      request<{ ok: boolean }>('auth/logout', {
        method: 'POST',
        skipAuthRedirect: true,
      }),
  },
  settings: {
    get: () =>
      request<{ admin_password_set_at: string | null; envOverride: boolean }>('settings'),
    updatePassword: (currentPassword: string, newPassword: string) =>
      request<{ admin_password_set_at: string | null }>('settings/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
  },
  employees: {
    list: () => request<Employee[]>('employees'),
    create: (input: EmployeeInput) =>
      request<Employee>('employees', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    update: (id: string, input: EmployeeInput) =>
      request<Employee>(`employees/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`employees/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
  },
  vehicles: {
    list: () => request<Vehicle[]>('vehicles'),
    create: (input: VehicleInput) =>
      request<Vehicle>('vehicles', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    update: (id: string, input: VehicleInput) =>
      request<Vehicle>(`vehicles/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`vehicles/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
  },
  projects: {
    list: () => request<ProjectWithCount[]>('projects'),
    create: (input: ProjectInput) =>
      request<ProjectWithCount>('projects', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    update: (id: string, input: ProjectInput) =>
      request<ProjectWithCount>(`projects/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`projects/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
  },
  missionOrders: {
    list: (orderBy: 'created_at' | 'start_date' = 'created_at') =>
      request<MissionOrderWithRelations[]>(`mission-orders?orderBy=${encodeURIComponent(orderBy)}`),
    create: (input: MissionOrderInput) =>
      request<MissionOrderWithRelations>('mission-orders', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    update: (id: string, input: MissionOrderInput) =>
      request<MissionOrderWithRelations>(`mission-orders/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`mission-orders/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
  },
};
