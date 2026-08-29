import { HashRouter } from 'react-router-dom';
import AppRoutes from './routes';
import TabBar from '../components/TabBar';

export default function App() {
  return (
    <HashRouter>
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-surface pb-16 text-ink">
        <main className="flex-1">
          <AppRoutes />
        </main>
        <TabBar />
      </div>
    </HashRouter>
  );
}
