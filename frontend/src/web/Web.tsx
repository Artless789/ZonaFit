import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { WebRoutes } from './WebRoutes';
import { AmbientBackground } from '../components/layout/AmbientBackground';
import { ErrorBoundary } from '@shared/ui/ErrorBoundary';

import { ThemeProvider } from '../context/ThemeContext';

function Web() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AmbientBackground />
        <ErrorBoundary>
          <AuthProvider>
            <WebRoutes />
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default Web;