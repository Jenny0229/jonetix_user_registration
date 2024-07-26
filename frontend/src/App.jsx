import React from 'react';
import { Outlet } from 'react-router-dom';
import './App.css';

const App = () => {
  return (
    <div className="App">
      <Outlet /> {/* This will render child routes */}
    </div>
  );
};

export default App;