// src/App.js
import React, { useState, useEffect, useRef } from 'react';
import { auth, provider, db } from './firebase'; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, getDocs } from 'firebase/firestore';
import './App.css'; // 【新增】：引入我們寫好的 LINE 風格 CSS

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);
  
  const [users, setUsers] = useState([]); 
  const [selectedChatUser, setSelectedChatUser] = useState(null); // 改存選中的使用者物件，方便顯示名字
  const [selectedChatId, setSelectedChatId] = useState(null); 
  const [messages, setMessages] = useState([]); 
  const [newMessage, setNewMessage] = useState(""); 
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) fetchAllUsers(); 
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedChatId) return;
    const q = query(
      collection(db, "chats", selectedChatId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [selectedChatId]);

  const fetchAllUsers = async () => {
    const q = query(collection(db, "users"));
    const querySnapshot = await getDocs(q);
    const usersList = [];
    querySnapshot.forEach((doc) => {
      if (doc.id !== auth.currentUser.uid) {
        usersList.push({ id: doc.id, ...doc.data() });
      }
    });
    setUsers(usersList);
  };

  const saveUserToFirestore = async (loggedUser) => {
    const userRef = doc(db, "users", loggedUser.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: loggedUser.uid,
        email: loggedUser.email,
        displayName: loggedUser.displayName || "匿名使用者",
        photoURL: loggedUser.photoURL || "",
        createdAt: serverTimestamp()
      });
    }
  };

  const startChat = async (targetUser) => {
    const chatId = [auth.currentUser.uid, targetUser.uid].sort().join("_");
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      await setDoc(chatRef, {
        members: [auth.currentUser.uid, targetUser.uid],
        createdAt: serverTimestamp(),
        type: "private" 
      });
    }
    setSelectedChatId(chatId);
    setSelectedChatUser(targetUser); // 記錄點選了誰，標題才顯示得出來
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    // 1. 先把使用者輸入的文字存到一個暫時的變數裡
    const textToSend = newMessage.trim();
    if (textToSend === "" || !selectedChatId) return;

    setNewMessage("");

    try {
      await addDoc(collection(db, "chats", selectedChatId, "messages"), {
        text: textToSend, // 這裡要改用我們剛剛存的變數
        senderId: auth.currentUser.uid,
        senderEmail: auth.currentUser.email,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("發送失敗", error);
      alert("訊息發送失敗，請檢查網路連線！");
      setNewMessage(textToSend); 
    }
  };

  // Auth Functions
  const handleRegister = async () => { try { const res = await createUserWithEmailAndPassword(auth, email, password); await saveUserToFirestore(res.user); } catch (e) { alert(e.message); } };
  const handleLogin = async () => { try { await signInWithEmailAndPassword(auth, email, password); } catch (e) { alert(e.message); } };
  const handleGoogleLogin = async () => { try { const res = await signInWithPopup(auth, provider); await saveUserToFirestore(res.user); } catch (e) { alert(e.message); } };
  const handleLogout = async () => { await signOut(auth); setSelectedChatId(null); setSelectedChatUser(null); };

  // --- 畫面渲染 ---
  if (!user) {
    return (
      <div className="login-container">
        <h1 style={{ color: "#06C755" }}>NTHU Chat</h1>
        <h3 style={{ color: "#555" }}>請先登入</h3>
        <input className="login-input" type="email" placeholder="信箱" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="login-input" type="password" placeholder="密碼" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div>
          <button className="btn-primary" onClick={handleLogin}>登入</button>
          <button className="btn-primary" onClick={handleRegister} style={{ marginLeft: "10px", backgroundColor: "#555" }}>註冊</button>
        </div>
        <hr style={{ margin: "20px 0", border: "0.5px solid #eee" }} />
        <button onClick={handleGoogleLogin} style={{ width: "100%", padding: "10px", background: "white", border: "1px solid #ddd", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}>
          使用 Google 登入
        </button>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* 左側：聯絡人列表 */}
      <div className="sidebar">
        <div className="sidebar-header">
          <span>好友列表</span>
          <button className="logout-btn" onClick={handleLogout}>登出</button>
        </div>
        <div className="user-list">
          {users.map(u => (
            <div 
              key={u.uid} 
              className={`user-item ${selectedChatUser?.uid === u.uid ? 'active' : ''}`}
              onClick={() => startChat(u)}
            >
              <div className="user-avatar">{u.email.charAt(0).toUpperCase()}</div>
              <div>{u.displayName || u.email.split('@')[0]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 右側：聊天室區域 */}
      <div className="chat-area">
        {selectedChatId ? (
          <>
            <div className="chat-header">
              {selectedChatUser?.displayName || selectedChatUser?.email}
            </div>
            
            <div className="messages-container">
              {messages.map(m => {
                const isMine = m.senderId === auth.currentUser.uid;
                return (
                  <div key={m.id} className={`message-wrapper ${isMine ? 'mine' : 'other'}`}>
                    <div className="message-sender">{m.senderEmail.split('@')[0]}</div>
                    <div className="message-bubble">{m.text}</div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form className="input-area" onSubmit={sendMessage}>
              <input 
                className="chat-input"
                value={newMessage} 
                onChange={(e) => setNewMessage(e.target.value)} 
                placeholder="輸入訊息..." 
              />
              <button type="submit" className="send-btn" disabled={!newMessage.trim()}>
                傳送
              </button>
            </form>
          </>
        ) : (
          <div className="empty-chat">
            請選擇左側的好友開始聊天
          </div>
        )}
      </div>
    </div>
  );
}

export default App;