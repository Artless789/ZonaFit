import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { AppOperativaRoutes } from './AppOperativaRoutes';
import { AmbientBackground } from '../components/layout/AmbientBackground';
import { ErrorBoundary } from '@shared/ui/ErrorBoundary';

import { ThemeProvider } from '../context/ThemeContext';

function AppOperativa() {
  return (
    <BrowserRouter basename="/app">
      <ThemeProvider>
        <AmbientBackground />
        <ErrorBoundary>
          <AuthProvider>
            <AppOperativaRoutes />
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default AppOperativa;