import React from 'react';
import { Routes, Route } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import HomePage from './HomePage';
import CheckinPage from './CheckinPage';
import DataEditor from './DataEditor';
import './App.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/:userId" element={<CheckinPage />} />
      <Route path="/:userId/data" element={<DataEditor />} />
    </Routes>
  );
}

export default App;
