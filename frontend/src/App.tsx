import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppRoutes } from './routes/AppRoutes';
import { AmbientBackground } from './components/layout/AmbientBackground';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

import { ThemeProvider } from './context/ThemeContext';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AmbientBackground />
        <ErrorBoundary>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;