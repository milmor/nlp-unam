export interface Course {
  id: number;
  name: string;
  term: string | null;
  description: string | null;
  signups_open: boolean;
  created_at: string;
}

export interface Assignment {
  reference_notebook?: string | null;
  id: number;
  title: string;
  description?: string | null;
  deadline?: string | null; // ISO 8601 timestamptz from Supabase
}

export interface Submission {
  id: number;
  assignment_id: number;
  student_id: string;
  notebook_url: string | null;
  score: number | null;
  feedback: string | null;
  created_at: string;
  verification_requested?: boolean;
  verification_requested_at?: string | null;
  verification_comment?: string | null;
}

export interface AdminSubmission {
  id: number;
  assignment_id: number;
  notebook_url?: string | null;
  score?: number | null;
  feedback?: string | null;
  created_at: string;
  verification_requested?: boolean;
  verification_requested_at?: string | null;
  verification_comment?: string | null;
  student?: { email: string; name: string | null; role: string | null } | null;
  assignment?: { title: string } | null;
}

export type UserRole = 'admin' | 'student' | null;
export type AuthState = 'loading' | 'unauthenticated' | 'student' | 'admin';
