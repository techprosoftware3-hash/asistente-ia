export type Employee = {
  id: string;

  user_id: string;

  name: string;

  role: string;

  objective: string;

  personality: string | null;

  instructions: string | null;

  rules: string[];

  tools: string[];

  status: string;

  created_at: string;

  updated_at: string;
};