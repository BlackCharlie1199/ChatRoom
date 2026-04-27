// src/App.js
import React, { useState, useEffect } from 'react';
import { auth, provider } from './firebase'; // import auth and google login we wrote in firebase.js
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  signInWithPopup 
} from 'firebase/auth';

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);

  // add hook when web initializing
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser); 
    });
    return () => unsubscribe(); 
  }, []);

  // register button
  const handleRegister = async () => {
    try {
      // call firebase auth
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.log(error.message)
    }
  };

  // login button
  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.log(error.message)
    }
  };

  // google login button
  const handleGoogleLogin = async () => {
    try {
      // call firebase login and google provider
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.log(error.message)
    }
  };

  // logout button
  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>NTHU 聊天室</h1>

      {/* if user has loged in, showing welcome page */}
      {user ? (
        <div>
          <p>歡迎回來，{user.displayName || user.email}!</p>
          <button onClick={handleLogout}>登出</button>
        </div>
      ) : (
        <div>
          <h3>請先登入或註冊</h3>
          <input 
            type="email" 
            placeholder="請輸入信箱" 
            value={email}
            onChange={(e) => setEmail(e.target.value)} 
          />
          <br /><br />
          <input 
            type="password" 
            placeholder="請輸入密碼 (至少 6 碼)" 
            value={password}
            onChange={(e) => setPassword(e.target.value)} 
          />
          <br /><br />
          <button onClick={handleLogin}>登入</button>
          <button onClick={handleRegister} style={{ marginLeft: "10px" }}>註冊</button>
          <button 
            onClick={handleGoogleLogin} 
            style={{ 
              padding: "10px", 
              backgroundColor: "#4285F4", 
              color: "white", 
              border: "none", 
              borderRadius: "5px", 
              cursor: "pointer" 
            }}
          >
            使用 Google 帳號登入
          </button>
        </div>
      )}
    </div>
  );
}

export default App;