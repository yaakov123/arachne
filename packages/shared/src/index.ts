export interface User {
  id: string;
  name: string;
  email: string;
}

export const formatUserName = (user: User): string => {
  return `${user.name} (${user.email})`;
};

export const createUser = (name: string, email: string): User => {
  return {
    id: crypto.randomUUID(),
    name,
    email,
  };
};