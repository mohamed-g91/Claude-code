import { Routes, Route } from 'react-router-dom';
import Today from '../screens/Today';
import Practice from '../screens/Practice';
import Session from '../screens/Session';
import Progress from '../screens/Progress';
import Settings from '../screens/Settings';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Today />} />
      <Route path="/practice" element={<Practice />} />
      <Route path="/session/:mode" element={<Session />} />
      <Route path="/progress" element={<Progress />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}
