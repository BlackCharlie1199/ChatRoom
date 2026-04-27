// src/App.js
import React, { useState, useEffect } from 'react';
import { auth, provider, db } from './firebase'; // import necessary tools we wrote in firebase.js
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  signInWithPopup 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

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

  const saveUserToFirestore = async (loggedUser) => {
    const userRef = doc(db, "users", loggedUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: loggedUser.uid,
        email: loggedUser.email,
        displayName: loggedUser.displayName || "匿名使用者", 
        photoURL: loggedUser.photoURL || "", 
        createdAt: new Date()
      });
      console.log("新使用者已成功寫入資料庫！");
    }
  };

  // register button
  const handleRegister = async () => {
    try {
      // call firebase auth
      const userData = await createUserWithEmailAndPassword(auth, email, password);
      await saveUserToFirestore(userData.user);
      alert("註冊成功！");
    } catch (error) {
      console.log(error.message)
      alert("註冊失敗：" + error.message);
    }
  };

  // login button
  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert("登入成功！");
    } catch (error) {
      console.log(error.message)
      alert("登入失敗：" + error.message);
    }
  };

  // google login button
  const handleGoogleLogin = async () => {
    try {
      // call firebase login and google provider
      const userData = await signInWithPopup(auth, provider);
      await saveUserToFirestore(userData.user);
      alert("Google 登入成功！");
    } catch (error) {
      console.log(error.message)
      alert("Google 登入失敗：" + error.message);
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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              maxWidth: "250px",
              padding: "10px", 
              backgroundColor: "#ffffff", 
              color: "#757575", 
              border: "1px solid #ddd", 
              borderRadius: "4px", 
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold",
              marginTop: "10px"
            }}
          >
            <img 
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
              alt="Google logo" 
              style={{ width: "18px", height: "18px", marginRight: "10px" }}
            />
            使用 Google 帳號登入
          </button>
        </div>
      )}
    </div>
  );
}

export default App;