import './index.css';
import './global.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth';

const client = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>
    </AuthProvider>
  </React.StrictMode>,
);
