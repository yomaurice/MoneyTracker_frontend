'use client';

import { createContext, useContext } from 'react';

export type User = { username: string } | null;

export const UserContext = createContext<User>(null);

export const useUser = () => useContext(UserContext);
