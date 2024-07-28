import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import './App.css';

const App = () => {
  return (
    <div className="App">
      <h1>Welcome to Web Authentication</h1>
      <nav>
        <Link to="login"><button>Log In</button></Link>
        <Link to="register"><button>Register</button></Link>
      </nav>
      <Outlet /> {/* This will render child routes like Login or Register */}
    </div>
  );
};

export default App;
