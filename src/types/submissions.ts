export interface Assignment {
  id: number;
  title: string;
  description?: string | null;
}

export interface Submission {
  id: number;
  assignment_id: number;
  student_id: string;
  notebook_url?: string | null;
  score?: number | null;
  feedback?: string | null;
  created_at: string;
}

export interface AdminSubmission {
  id: number;
  notebook_url?: string | null;
  score?: number | null;
  feedback?: string | null;
  created_at: string;
  student?: { email: string; role: string | null } | null;
  assignment?: { title: string } | null;
}

export type UserRole = 'admin' | 'student' | null;
export type AuthState = 'loading' | 'unauthenticated' | 'student' | 'admin';
