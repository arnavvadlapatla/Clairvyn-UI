import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Splash from './pages/splash';
import Login from './pages/login';
import Form from './pages/form';
import Chat from './pages/chat';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route element={<Layout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/form" element={<Form />} />
          <Route path="/chat" element={<Chat />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

















