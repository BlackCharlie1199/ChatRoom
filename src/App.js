// src/App.js
import React, { useState, useEffect } from 'react';
import { auth } from './firebase'; // 匯入我們剛剛寫好的連線橋樑
// 匯入 Firebase 提供的各種驗證功能
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

function App() {
  // 建立 React 狀態 (State) 來儲存使用者輸入的信箱、密碼，以及當前的登入狀態
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);

  // useEffect 會在網頁載入時執行一次，用來監聽使用者是否已經登入
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser); // 如果有登入，就會把資料存進 user 變數
    });
    return () => unsubscribe(); // 離開網頁時清除監聽，節省資源
  }, []);

  // 註冊按鈕的執行邏輯
  const handleRegister = async () => {
    try {
      // 呼叫 Firebase 註冊功能
      await createUserWithEmailAndPassword(auth, email, password);
      alert("註冊成功！");
    } catch (error) {
      alert("註冊失敗：" + error.message);
    }
  };

  // 登入按鈕的執行邏輯
  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert("登入成功！");
    } catch (error) {
      alert("登入失敗：" + error.message);
    }
  };

  // 登出按鈕的執行邏輯
  const handleLogout = async () => {
    await signOut(auth);
    alert("已登出！");
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>NTHU 聊天室</h1>

      {/* 條件渲染：如果 user 存在 (已登入)，就顯示歡迎畫面，否則顯示登入表單 */}
      {user ? (
        <div>
          <p>歡迎回來，{user.email}！</p>
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
        </div>
      )}
    </div>
  );
}

export default App;